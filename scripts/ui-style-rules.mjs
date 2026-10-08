import ts from 'typescript';

const controlVisuals = new Set([
  'background',
  'backgroundColor',
  'color',
  'border',
  'borderColor',
  'borderRadius',
  'padding',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'outline',
  'boxSizing',
  'lineHeight',
  'boxShadow',
]);
const decorative = new Set([
  'background',
  'backgroundColor',
  'color',
  'border',
  'borderRadius',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'fontStyle',
  'boxShadow',
  'textTransform',
  'letterSpacing',
]);
const sharedWidgets = new Set([
  'MenuSurface',
  'MenuItem',
  'ResourcePreview',
  'ResourceDetailsCard',
  'InspectorInfo',
  'InspectorInfoTip',
  'InspectorWarning',
  'InspectorError',
  'ResourceSelect',
]);

// 规则依赖语法树与结构，而非行号白名单；布局和画布几何不属于重复外观。
export function inspectUiSource(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const errors = [],
    profiles = [],
    declarations = new Map();
  const owner = file.replaceAll('\\', '/').startsWith('components/shared/');
  const report = (node, message) =>
    errors.push(
      `${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: ${message}`,
    );
  const propertyName = (property) => property.name?.getText(source).replace(/^['"]|['"]$/g, '');
  function collect(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer)
      declarations.set(node.name.text, node.initializer);
    ts.forEachChild(node, collect);
  }
  collect(source);
  function properties(expression, seen = new Set()) {
    if (!expression) return [];
    if (ts.isAsExpression(expression) || ts.isParenthesizedExpression(expression))
      return properties(expression.expression, seen);
    if (ts.isIdentifier(expression) && !seen.has(expression.text)) {
      const next = new Set(seen).add(expression.text);
      return properties(declarations.get(expression.text), next);
    }
    if (ts.isObjectLiteralExpression(expression))
      return expression.properties.flatMap((property) =>
        ts.isSpreadAssignment(property) ? properties(property.expression, seen) : [property],
      );
    return [];
  }
  function visit(node) {
    if (!owner && (ts.isVariableStatement(node) || ts.isFunctionDeclaration(node))) {
      const content = node.getText(source);
      const names = ts.isVariableStatement(node)
        ? node.declarationList.declarations
            .map((declaration) => declaration.name.getText(source))
            .join(' ')
        : node.name?.getText(source) || '';
      if (
        /(?:#[0-9a-f]{3,8}|rgba?\()/.test(content) &&
        ((/color|palette/i.test(names) &&
          /['"]boolean['"]/.test(content) &&
          /['"]integer['"]/.test(content) &&
          /['"]float['"]/.test(content)) ||
          /(?:categoryColors|scopeColors|stateColors)\s*[:=]/.test(content))
      )
        report(node, '语义色映射必须复用 components/shared/uiTokens.ts。');
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source),
        attrs = node.attributes.properties;
      const attr = (name) =>
        attrs.find((item) => ts.isJsxAttribute(item) && item.name.getText(source) === name);
      const type = attr('type')?.initializer;
      const primitive =
        type &&
        ts.isStringLiteral(type) &&
        ['checkbox', 'radio', 'range', 'file', 'color', 'hidden'].includes(type.text);
      const control = ['input', 'select', 'textarea'].includes(tag) && !primitive;
      const classText = attr('className')?.getText(source) || '';
      if (control && !classText.includes('ui-control'))
        report(node, '文本、数字、选择和多行控件必须使用 ui-control。');
      const style = attr('style')?.initializer?.expression;
      const props = properties(style);
      if (
        (control || (!owner && sharedWidgets.has(tag))) &&
        props.some(
          (prop) => ts.isPropertyAssignment(prop) && controlVisuals.has(propertyName(prop)),
        )
      )
        report(node, '控件或共享组件不得在业务层覆盖基础外观；使用共享变体或语义变量。');
      if (
        !owner &&
        /^[a-z]/.test(tag) &&
        /(?:canvas-context-menu|ctx-item|menu-item)/.test(classText)
      )
        report(node, '菜单必须复用 MenuSurface/MenuItem/MenuSeparator。');
      if (
        !owner &&
        attr('role')?.initializer &&
        ts.isStringLiteral(attr('role').initializer) &&
        ['menu', 'menuitem', 'dialog'].includes(attr('role').initializer.text)
      )
        report(node, '菜单和弹窗语义由共享组件统一提供。');
      if (
        props.length >= 4 &&
        props.every(ts.isPropertyAssignment) &&
        props.filter((prop) => decorative.has(propertyName(prop))).length >= 2
      ) {
        const profile = props
          .map((prop) => [
            propertyName(prop),
            prop.initializer.getText(source).replace(/\s+/g, ' '),
          ])
          .sort(([a], [b]) => a.localeCompare(b));
        profiles.push({
          key: JSON.stringify(profile),
          file,
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return { errors, profiles };
}

export function inspectUiProject(sources) {
  const errors = [],
    profiles = new Map();
  for (const [file, text] of sources) {
    const result = inspectUiSource(file, text);
    errors.push(...result.errors);
    for (const profile of result.profiles) {
      const group = profiles.get(profile.key) || [];
      group.push(profile);
      profiles.set(profile.key, group);
    }
    if (
      file.endsWith('.css') &&
      !file.replaceAll('\\', '/').endsWith('components/shared/theme.css') &&
      /--(?:variable-(?:boolean|integer|float|string)|scope-(?:Global|StageLocal|NodeLocal|Temporary)|state-(?:Draft|Implemented|MarkedForDelete)|resource-(?:performance|lifecycle|condition|trigger))\s*:/.test(
        text,
      )
    )
      errors.push(`${file}: 语义主题变量只允许在 theme.css 定义。`);
    if (file.endsWith('.css') && !file.replaceAll('\\', '/').endsWith('components/shared/ui.css')) {
      for (const match of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (
          /\.(?:ui-control|ui-menu(?:-item|-separator)?|ui-resource-preview|ui-graph-node|ui-edge-label|ui-id|ui-description|ui-entity-heading|inspector-section-title)\b/.test(
            match[1],
          )
        )
          errors.push(`${file}: 共享外观选择器只能在 ui.css 定义。`);
        if (
          /\.(?:inspector-(?:name-input|textarea|number-input|input|select|type-select)|dialog-input|search-input|filter-select)(?![\w-])/.test(
            match[1],
          ) &&
          /(?:^|;)\s*(?:background(?:-color)?|border(?:-color|-radius)?|color|font(?:-size|-family|-weight)?|padding)\s*:/.test(
            match[2],
          ) &&
          !match[1].includes(' option')
        )
          errors.push(`${file}: 旧控件类只能保留布局，不得恢复独立外观。`);
      }
    }
  }
  for (const group of profiles.values())
    if (new Set(group.map((item) => item.file)).size > 1)
      errors.push(
        `跨文件重复外观: ${group.map((item) => `${item.file}:${item.line}`).join(', ')}。提取为共享组件或样式。`,
      );
  return errors;
}

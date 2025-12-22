/**
 * utils/translation/localDictionary.ts
 * 本地词典翻译服务
 * 
 * 提供常用游戏/谜题相关词汇的中英文映射
 * 无需网络，覆盖有限但响应快速
 */

/**
 * 中文 -> 英文 词汇映射表
 * 按使用频率和游戏/谜题领域整理
 */
const DICTIONARY: Record<string, string> = {
    // 基础动作
    '开始': 'Start',
    '结束': 'End',
    '完成': 'Complete',
    '初始': 'Initial',
    '触发': 'Trigger',
    '激活': 'Activate',
    '禁用': 'Disable',
    '启用': 'Enable',
    '重置': 'Reset',
    '等待': 'Wait',
    '检查': 'Check',
    '验证': 'Verify',
    '解锁': 'Unlock',
    '锁定': 'Lock',
    '打开': 'Open',
    '关闭': 'Close',
    '进入': 'Enter',
    '退出': 'Exit',
    '移动': 'Move',
    '旋转': 'Rotate',
    '缩放': 'Scale',
    '显示': 'Show',
    '隐藏': 'Hide',
    '播放': 'Play',
    '暂停': 'Pause',
    '停止': 'Stop',

    // 状态
    '空闲': 'Idle',
    '运行': 'Running',
    '暂停中': 'Paused',
    '已完成': 'Completed',
    '失败': 'Failed',
    '成功': 'Success',
    '进行中': 'InProgress',
    '未开始': 'NotStarted',
    '已触发': 'Triggered',
    '未触发': 'NotTriggered',
    '已激活': 'Activated',
    '未激活': 'NotActivated',
    '已解锁': 'Unlocked',
    '已锁定': 'Locked',

    // 游戏对象
    '门': 'Door',
    '锁': 'Lock',
    '钥匙': 'Key',
    '按钮': 'Button',
    '开关': 'Switch',
    '机关': 'Mechanism',
    '谜题': 'Puzzle',
    '关卡': 'Level',
    '章节': 'Chapter',
    '场景': 'Scene',
    '房间': 'Room',
    '区域': 'Area',
    '入口': 'Entrance',
    '出口': 'Exit',
    '通道': 'Passage',
    '走廊': 'Corridor',
    '楼梯': 'Stairs',
    '电梯': 'Elevator',
    '箱子': 'Box',
    '宝箱': 'Chest',
    '物品': 'Item',
    '道具': 'Prop',
    '工具': 'Tool',
    '提示': 'Hint',
    '线索': 'Clue',
    '密码': 'Password',
    '代码': 'Code',
    '符号': 'Symbol',
    '图案': 'Pattern',
    '颜色': 'Color',
    '数字': 'Number',
    '字母': 'Letter',
    '文字': 'Text',
    '画面': 'Screen',
    '画': 'Painting',
    '镜子': 'Mirror',
    '灯': 'Light',
    '火': 'Fire',
    '水': 'Water',
    '风': 'Wind',
    '土': 'Earth',

    // 玩家相关
    '玩家': 'Player',
    '角色': 'Character',
    '主角': 'Protagonist',
    '敌人': 'Enemy',
    '友方': 'Ally',
    '生命': 'Health',
    '能量': 'Energy',
    '分数': 'Score',
    '金币': 'Coin',
    '经验': 'Experience',
    '等级': 'Level',

    // 时间相关
    '计时器': 'Timer',
    '倒计时': 'Countdown',
    '延迟': 'Delay',
    '周期': 'Cycle',
    '循环': 'Loop',

    // 逻辑词
    '如果': 'If',
    '否则': 'Else',
    '并且': 'And',
    '或者': 'Or',
    '非': 'Not',
    '全部': 'All',
    '任意': 'Any',
    '无': 'None',
    '第一': 'First',
    '第二': 'Second',
    '第三': 'Third',
    '最后': 'Last',
    '下一个': 'Next',
    '上一个': 'Previous',

    // 常用组合
    '主菜单': 'MainMenu',
    '游戏开始': 'GameStart',
    '游戏结束': 'GameOver',
    '游戏暂停': 'GamePause',
    '游戏继续': 'GameResume',
    '新游戏': 'NewGame',
    '继续游戏': 'ContinueGame',
    '保存游戏': 'SaveGame',
    '加载游戏': 'LoadGame',
    '设置': 'Settings',
    '选项': 'Options',
    '帮助': 'Help',
    '关于': 'About',
    '返回': 'Back',
    '确认': 'Confirm',
    '取消': 'Cancel',
    '是': 'Yes',
    '否': 'No',
};

/**
 * 尝试分词并逐词翻译
 * @param text 中文文本
 * @returns 翻译结果（PascalCase）或 null
 */
function translateWithSplit(text: string): string | null {
    // 尝试匹配最长的词组
    let result = '';
    let remaining = text;

    while (remaining.length > 0) {
        let matched = false;

        // 从最长可能的词开始匹配
        for (let len = Math.min(remaining.length, 10); len >= 1; len--) {
            const word = remaining.substring(0, len);
            if (DICTIONARY[word]) {
                result += DICTIONARY[word];
                remaining = remaining.substring(len);
                matched = true;
                break;
            }
        }

        // 如果没有匹配到，无法完全翻译
        if (!matched) {
            return null;
        }
    }

    return result || null;
}

/**
 * 使用本地词典翻译中文文本为英文变量名
 * @param text 中文文本
 * @returns 翻译结果（PascalCase）或 null（无法翻译时）
 */
export function translateWithLocalDictionary(text: string): string | null {
    if (!text) return null;

    // 去除空格和特殊字符
    const cleaned = text.replace(/\s+/g, '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');

    // 如果是纯英文，直接转 PascalCase
    if (/^[a-zA-Z0-9]+$/.test(cleaned)) {
        return cleaned
            .split(/(?=[A-Z])|[\s_-]+/)
            .filter(Boolean)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');
    }

    // 首先尝试完整匹配
    if (DICTIONARY[cleaned]) {
        return DICTIONARY[cleaned];
    }

    // 尝试分词翻译
    return translateWithSplit(cleaned);
}

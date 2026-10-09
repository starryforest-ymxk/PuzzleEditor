# C13 技术设计：只读环境配置

日期：2026-10-09。在工具层建立唯一配置解析器，config path/show 与后续 doctor、Skill 共用。新增命令由同一能力及 Schema 注册。

可选配置为严格 {schemaVersion:1,desktopExecutable?:string}，默认受管根/config.json。命令 --config 优先于 PUZZLE_EDITOR_CLI_CONFIG，之后为默认；桌面路径由 PUZZLE_EDITOR_DESKTOP_EXECUTABLE 优先于配置文件。配置内相对路径按配置目录解析。任何未知/授权字段、重复键、无效 UTF-8 或未知版本拒绝。普通工程命令不加载可选配置，不改变工程路径或授权。

show 返回原值、生效值、逐项来源，以及当前构建/Node/API/权限策略/在线协议/转换器、便携或受管模式、Skill 候选位置、现有 sessionDirectory。path 只报告预期位置/是否存在，不解析正文。所有查询不建目录、不写配置、不启动桌面、不读完整会话登记或密钥。配置仅诊断桌面位置，不执行该文件。

测试缺省零创建、相对路径、环境覆盖、损坏配置及授权键拒绝，并保持所有输入原字节。UX_Flow 无新交互。

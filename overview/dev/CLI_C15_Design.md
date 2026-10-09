# C15 技术设计：只读 doctor

日期：2026-10-09。默认/offline 只查本地；online 必须显式 instance/session，不能与 offline 共用。project 为显式可选路径。使用统一配置、安装/Skill 所有权、工程读取/校验、会话安全与传输，禁止修复副作用。

每项返回稳定 code、pass/warn/fail/skip、英文 message、非敏感 evidence、suggestion；单项异常捕获后继续。发行完整性/明确请求的工程或在线错误为 fail；可选配置未提供桌面/Skill、未安装 PATH 等 warn/skip，不阻断便携使用。退出码无 fail 为 0，有 fail 为 3，非法参数沿用 2。stdout 单一 JSON。配置失败仍执行包、PATH、会话、工程检查。

检查实际版本、Node 支持范围、发行 manifest/许可证指纹、受管启动器、PATH 增量/当前进程刷新/同名命令、严格配置及桌面声明路径、默认用户 Skill 指纹与参考兼容、发现目录 ACL。仅 online 才握手 status，不 discover 全实例，不提交草稿、不启动桌面。工程调用共同读取和领域校验，所有权只连接已有 OS 端点探测，不创建锁；无 owner 不代表未来写入有保证。

不输出 HMAC/登记原文/项目正文，不读最近工程，不修改设置、Skill 或磁盘工程。测试健康便携、坏配置/坏包、命令遮蔽、坏工程、明确在线失败、参数错误及前后原字节一致；真实在线状态在 C16 成品回归覆盖。UX_Flow 无新交互。

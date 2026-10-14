# ProjectSekai GameData

ProjectSekai 的公开、版本化游戏数据仓库。数据由独立采集工具生成，不需要机器人、数据库或游戏进程。采集工具源码和操作说明位于 [ProjectSekai](https://github.com/lingwunb666/ProjectSekai/tree/main/tools/game-data-collector)。

## 区域和语言

区域 `international` 表示国际服，`china` 表示国服。语言 `en`、`zh`、`tc` 分别表示英文、简体中文、繁体中文。**国际服的 `zh` 不是国服数据。** 两个区域独立发布、独立版本，不相互回退。

- 国际服：直接从 Digital Extremes PublicExport 获取，按语言索引固定文件地址。
- 国服：需要经确认的独立官方入口，或带国服来源声明及客户端哈希的本地结构化导出。目前未发布国服版本，详见 `datasets/china/status.json`。
- 已审核补充：可包含由明确版本的游戏资源整理的数值与规则，独立保存来源；不自动覆盖不同版本的官方导出。

## 获取数据

每个区域的 `datasets/<region>/latest.json` 只用于发现版本，消费者必须锁定 Git 提交和 `manifestSha256`，不能把 `main` 当作不可变版本。数据位于 `datasets/<region>/releases/<releaseId>/`。

1. 从固定 Git 提交读取 `latest.json` 或指定版本的 `manifest.json`。
2. 校验 manifest SHA-256、区域、格式版本及所需能力。
3. 按 `manifest.files` 下载并校验文件大小与 SHA-256。
4. 在本地构建、检查，再发布给业务使用；仓库发布不等于生产数据库切换。

无需下载游戏程序或大型资源包。`exports/<locale>/Export*.json` 使用统一信封，`sections` 保留官方各分类的原始结构；`reviewed/*.json` 保存已审核补充。详细格式见 [数据格式](FORMAT.md)。

## 验证

使用 Node.js 24 运行 `node scripts/verify.mjs`。CI 在每次提交及 Pull Request 中检查所有版本的内容标识、校验和、区域、路径与公开内容边界。

版本标识由区域、来源、能力及文件校验清单共同生成。同样的输入重复采集不会生成新版本。已发布版本不原地修改，`latest.json` 可以指向另一个有效版本；历史版本及固定 Git 提交仍可用于回滚。

## 范围和权利

官方导出不是完整游戏机制数据库。数据中的武器存在，不代表某个引擎已经实现它的全部攻击、被动、灵化或架势。本仓库当前的数据格式也不直接替换 ProjectSekai 既有 Catalog parser；消费侧适配与机制覆盖检查是独立步骤。

仓库不包含账号、凭据、个人游戏记录、客户端二进制、IDA 数据库或完整资源包。游戏名称、文本及其他游戏内容的权利仍属于其各自权利人；本项目不对上游游戏数据另行授予所有权或再许可。仓库不是 Digital Extremes 或国服运营方的官方产品。

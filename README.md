# ProjectSekai GameData

ProjectSekai 的公开、版本化游戏数据仓库。数据由独立采集工具生成，不需要机器人、数据库或游戏进程。采集工具源码和操作说明位于 [ProjectSekai](https://github.com/lingwunb666/ProjectSekai/tree/main/tools/game-data-collector)。

## 区域和语言

区域 `international` 表示国际服，`china` 表示国服。语言 `en`、`zh`、`tc` 分别表示英文、简体中文、繁体中文。**国际服的 `zh` 不是国服数据。** 两个区域独立发布、独立版本，不相互回退。

- 国际服：Digital Extremes PublicExport、官方掉落表及独立国际服客户端只读采集。PublicExport 按语言索引固定文件地址；客户端补充技能、任务、奖励池、武器行为等官方导出未覆盖的结构，分别保留来源与哈希。
- 国服：没有 PublicExport，从独立国服客户端只读提取，保留客户端、资源和语言包哈希。物品、白名单属性和关联文本的覆盖情况见版本内 `ExportClientCoverage.json`，不使用国际服填补缺失。
- 已审核补充：可包含由明确版本的游戏资源整理的数值与规则，独立保存来源；不自动覆盖不同版本的官方导出。

## 获取数据

每个区域的 `datasets/<region>/latest.json` 只用于发现版本，消费者必须锁定 Git 提交和 `manifestSha256`，不能把 `main` 当作不可变版本。数据位于 `datasets/<region>/releases/<releaseId>/`。

当前国际服为采集器 1.90.0 的 `gd1-e5afb0c944e4b15ad0fffa4c`，对应本机国际服客户端 `2026.10.22.13.12`：重新采集紫卡与武器参数、弹药效率相关来源，补充当前版卡面说明、怒吼动画参数、NPC 倒地保护配置和伤害处理器引用，并保留完整父链、脚本和专精来源。国际服 1.84 → 1.85 → 1.86 → 1.87 → 1.88 → 1.89 → 1.90 的增量链按顺序保留；不会跳过底座修正。国服当前包为采集器 1.90.0 的 `gd1-2b06215fda3eed4254ee1e5f`，客户端仍为 `2026.10.15.13.58`：以国服 1.79.0 包为底座，从本服客户端独立补采相同类别的 NPC 字段，游戏版本没有改变。两服按各自实际数据发布，不跨服补值；国际服新的弹药与紫卡规则不会仅因同名装备而应用到国服。来源包发布不代表其中每项机制都已获战斗引擎准入；消费侧须单独检查相应规则。

1.88.0 新增的四项配置为 `InvulnerableInPreDeath`、`IgnoreInPreDeath`、`GetUpFromPreDeathHealth` 和 `PreDeathRevivesLeft`。每服独立检查 2,865 个已选 NPC 祖先资源，保留显式值、声明来源和缺失状态，并修复三处被子项覆盖而遗漏的父级命中部位声明。这些是资源配置，不能直接代表实时倒地状态或击杀事件。增量更新复用未变化文件，没有重新采集整份客户端。

1.89.0 在各服自己的 1.88 包上补充 `CanPreDeath`、`ShouldKillAfterPreDeath`、`CanFinisherInPreDeath`、`ShouldRagdollAfterPreDeath`。仍逐项检查相同的完整祖先集合；已有配置、成员、关系和文本保持不变。没有声明的配置继续保留为缺失，不自动补入原生缺省值，也不把国际服的程序行为套到国服。

1.90.0 补充 `InjuryHandlersEx`、`PainHandler`、`PreDeathHandler`、`DeathHandler` 在完整已选祖先链中的原始声明和作用域引用。两服各自的 4,949 条引用均解析成功；`ancestryReferences` 标记这四项的祖先采集覆盖。明确空字符串、缺失声明和未解析引用仍有不同含义。这里提供资源配置，不能直接当成实时处理器实例或已发生的击杀通知。

已撤回推荐：国际服 `gd1-3ad0e99f9cf7145225f0e7e9` 的专精数据有效，但增量底座过旧，漏带后来的配方数量继承修正；不要固定到该版本。发现后先恢复前版发现指针，再以 `gd1-a5e40f83e4fc2cc6e4f913e7`（采集器 1.77.1）替代，完整保留配方及既有脚本修正。对应国服修正版为 `gd1-30216259cad63756e5c45f99`。旧版本只保留在不可变历史中用于追溯；内容校验通过不等于已证明所有业务修正都得到保留。

1. 从固定 Git 提交读取 `latest.json` 或指定版本的 `manifest.json`。
2. 校验 manifest SHA-256、区域、格式版本及所需能力。
3. 按 `manifest.files` 下载并校验文件大小与 SHA-256。
4. 在本地构建、检查，再发布给业务使用；仓库发布不等于生产数据库切换。

无需下载游戏程序或大型资源包。`exports/<locale>/Export*.json` 使用统一信封；官方分类与本地 `Client*` 分类有不同的能力和结构，消费者必须明确支持，不能只根据路径导入。`reviewed/*.json` 保存已审核补充。带 `regional-catalog` 对应版本能力的包还提供 `canonical/` 实体、语言变体、引用关系及覆盖报告，可用于区域化查询。v3 及之后版本使用精确来源引用，v5 将重复来源位置放入分片内字典，原始记录仍只保存一份。详细格式见 [数据格式](FORMAT.md)。

客户端采集只提供本区域实际安装的语言。`NOT_INSTALLED` 表示本次安装缺少该语言，不代表游戏没有该语言，也不允许借用其它区域或把简体中文替换成国服。奖励资料、图片和战斗输入同样必须来自消费者锁定的区域与版本。文档中的已支持格式不代表相应最新数据包已发布；以固定提交内的 manifest 及能力清单为准。

采集工具的 `fetch --region ... --commit ... --version ... --sha256 ... --output ...` 可按固定提交下载并校验一个版本；`query` 可离线查询统一模型。ProjectSekai 后端提供 `/api/v2/catalog/self-hosted/{region}/search`，需显式配置各区域固定包，并具有 `catalog.view` 权限。查询不会联网或自动切换原有战斗数据源。

## 验证

使用 Node.js 24 运行 `node scripts/verify.mjs`，检查当前检出的全部版本；指定任一历史固定包可用 `node scripts/verify.mjs --release <目录>`。

结构化单区域包的文件总量上限为 640 MiB，单文件仍限制为 48 MiB，清单最多 512 个文件。2026-10-22 国际服更新的完整包略超旧的 512 MiB 限制，因此与采集器、后端同步这一有限上限；不会放宽来源、内容摘要或区域隔离校验，也不改变采集工作区的 10 GiB 总预算。

CI 先稀疏检出校验代码，再按各区域 `latest.json` 的 Git 历史选取当前版与上一不同版本，最多完整检查四份包的内容标识、全部文件校验和、来源、关系、区域、路径与公开内容边界，并运行全部脚本测试。不会重新展开几十份历史包，也不会删除 Git 中的历史版本或改写指针。历史包在发布时已校验，仍可按固定提交单独复验。这是工作目录与重复校验范围的限制，不降低选中包的内容检查。

`node scripts/ci-checkout.mjs` 只预览选择计划；`--apply` 仅允许在干净的 GitHub Actions 临时工作区中执行。浅历史、错误区域、manifest 哈希不一致或未知目录会失败。检出配置依据固定版本的 [actions/checkout 参数](https://github.com/actions/checkout/blob/d23441a48e516b6c34aea4fa41551a30e30af803/README.md)；显式使用稀疏模式和完整提交历史，不另设会覆盖稀疏选项的 `filter`。

`client-challenge-selection-facts-v1` 包含同服审阅过的特殊赏金选择／阵营规则与脚本指纹，不含脚本正文。校验器独立检查精确规则和来源；`REVIEW_REQUIRED` 只允许保留未审阅事实，不能用于生成推荐。业务还必须提供同服有效官方周期、有序节点覆盖及奖励资料，不能仅凭这个能力标记宣称赏金完整可用。

`client-arbitration-selection-facts-v1` 保存本服仲裁选择规则与四份脚本指纹，配合本服 `ClientSolarMap` 可在后端生成每小时节点。不包含旧第三方预测表、原始脚本或程序。校验器固定完整策略、两服各自的脚本指纹及实际采集来源；`REVIEW_REQUIRED` 不得用于生成轮换。规则不涉及账号解锁或个人装备加成，仓库支持该格式不代表最新包已上传或完成实机对照。

版本标识由区域、来源、能力及文件校验清单共同生成。同样的输入重复采集不会生成新版本。已发布版本不原地修改，`latest.json` 可以指向另一个有效版本；历史版本及固定 Git 提交仍可用于回滚。

## 范围和权利

官方导出不是完整游戏机制数据库。数据中的武器存在，不代表某个引擎已经实现它的全部攻击、被动、灵化或架势。本仓库当前的数据格式也不直接替换 ProjectSekai 既有 Catalog parser；消费侧适配与机制覆盖检查是独立步骤。

仓库不包含账号、凭据、个人游戏记录、客户端二进制、IDA 数据库或完整资源包。游戏名称、文本及其他游戏内容的权利仍属于其各自权利人；本项目不对上游游戏数据另行授予所有权或再许可。仓库不是 Digital Extremes 或国服运营方的官方产品。

## 区域图片包

结构化包新增 `client-complete-dictionaries-v1` 能力：`exports/en/ExportClientDictionary.json` 和 `exports/zh/ExportClientDictionary.json` 来自各服自己的完整语言包，词典按标签存储，不是物品数组。独立校验器核对两种语言、来源、声明计数、唯一标签和字符串边界；显式空串与缺失标签不能混淆，不跨服补值。能力支持不表示仓库已发布最新采集版本。

`scripts/verify-images.mjs --release <图片包目录>` 独立验证采集器生成的 `regional-image-assets-v1/v2` 包。包按区域及客户端来源标识，PNG 按 SHA-256 寻址，包含物品／商店图、文字图标及技能、挑战、专精、套装等显式贴图声明。v2 将四类完整元数据独立保存并固定哈希，主清单只保存来源与文件清单。验证覆盖来源哈希、图像闭包、mip 布局、PNG CRC、完整解压及额外文件；`complete=false` 不会被解释为功能验收通过。

图片包与结构化 `gd1-*` 版本分开，不能仅凭同名物品互相拼接，也不能拿国际服图片填补国服。消费侧绑定同区域、Packages 内容版本、客户端 EXE 和纹理目录哈希。图标／贴图版权仍归游戏权利人。

2026-10-23 国际服新增与上述 1.87.0 结构化包配对的[图片 Release](https://github.com/lingwunb666/ProjectSekai-GameData/releases/tag/images-international-gad1-2f853117efda7aba61282772)：分发版本 `gad1-2f853117efda7aba61282772`，索引 SHA-256 `22eea50dacf89fa11eea9f0fb943403d7dc1a9343200b7ed5d95f336714218b3`，图片 manifest SHA-256 `2024b1fcda90f103cece041954be575517b34ee7a96738c931a9f44937282f16`，固定目标提交 `648180964f505eb0323522a7790dbecff0de186f`。11 个分块和索引远端摘要已验证。包含 20,706 个 PNG；仍有 2,446 条图标覆盖诊断，保持 `complete=false`、prerelease。国服未随国际服更新，也没有生产激活。

2026-10-17 的历史配对保留如下，两个图片包仍有覆盖诊断，均为 prerelease、`complete=false`。发布不代表 ProjectSekai 已生产切换。

| 区域 | 结构化版本 | 图片分发版本 | 索引 SHA-256 |
| --- | --- | --- | --- |
| 国际服 | `gd1-d1183120429b80a3d5828948` | `gad1-965ba12a5b755a151a8a9266` | `828bf3abe32413df85cbd7bff37b916c7847f19c3efecebfd16d6bea0dab8d0b` |
| 国服 | `gd1-a7b3be54a91b59effce2be16` | `gad1-72f31c138eca7e8f27d7504b` | `dbd8e49831a4f87b78458b3256c63e7f7cb48248409cc56c878d87867241fc25` |

国际服配对的固定提交为 `2e274a1626eccd0e3fd6856dff1c6b7e68242fe5`，国服为 `a992ad6f5acd61bccee30d9274378ef41a5a3654`；下载前仍须验证结构化 manifest 及图片 manifest。图片分别见 [国际服 Release](https://github.com/lingwunb666/ProjectSekai-GameData/releases/tag/images-international-gad1-965ba12a5b755a151a8a9266) 和 [国服 Release](https://github.com/lingwunb666/ProjectSekai-GameData/releases/tag/images-china-gad1-72f31c138eca7e8f27d7504b)。各 11 个分块及索引已验证远端摘要；公开索引和固定提交的结构化清单已匿名下载复核，未重复下载整个图片包。

离线打包和恢复（Node.js 24）：

```sh
node scripts/image-distribution.mjs pack --release /data/china-images --output /data/china-image-distribution
node scripts/image-distribution.mjs restore --input /data/china-image-distribution --output /data/china-restored --region china --sha256 <indexSha256>
```

输出必须是新目录。每块最大 256 MiB，`distribution.json` 记录每个文件的连续偏移、长度、SHA-256 及每块 SHA-256；文件不再压缩，PNG 字节不变。恢复必须锁定可信发布记录中的索引哈希，最终重新校验完整图片包；中途失败不覆盖现有数据或自动启用。仅发布分发目录内的索引和 `.bin` 图片附件，不发布原始采集工作目录、游戏程序或凭据。此离线打包／恢复命令不上传 GitHub。

### 显式发布与获取

发布器默认只做本地校验：原图片包逐图校验，分块逐文件及整块流式核验，并要求两份清单完全一致。先将可信工具代码提交到数据仓库，再用其完整 40 位提交号作为 Release 目标；不能用分支名或 `latest`。

日常发布推荐索引模式：不在 PNG 之外保存整套分块副本。它产生的索引字节、版本 ID 和附件哈希与同尺寸完整打包完全一致，旧下载／恢复工具不需要升级格式。

```sh
node scripts/image-distribution.mjs plan --release /data/china-images --output /data/china-image-plan
node scripts/publish-images.mjs --on-demand --release /data/china-images --input /data/china-image-plan --region china --sha256 <indexSha256> --commit <fullCommit>
# 本地校验通过后，显式追加 --publish；存在诊断时仍需 --allow-incomplete。
```

`plan` 会完整验证原图片包和所有计划分块哈希，但只写 `distribution.json`；`--on-demand` 发布时只在该目录的独占 `.upload` 子目录生成当前缺失的一块，最多 256 MiB。每次上传前重新核对源文件及整块哈希，上传后或普通失败后删除本次创建且未被更改的临时块。已校验的远端附件直接跳过，不重新生成。源图片与索引保留供重试；不能用 `restore` 直接恢复只有索引的目录。全量 `pack` 仍适用于明确需要离线完整附件归档的情况。

进程被强制结束或临时块被其它程序改动时，`.upload` 会保留并阻止重试；请先确认没有发布进程，再检查这个明确目录，工具不会抢锁、递归删除或自动清理未知文件。主项目受预算约束的 `update.mjs` 已使用索引模式，分块写入前还检查整个工作根的现有占用、待写入大小及磁盘保留空间；单独运行本仓库发布命令只限制分块大小，不提供主项目的合计 8 GiB 配额保护。

已有完整分块目录仍可按原方式发布：

```sh
node scripts/publish-images.mjs --release /data/china-images --input /data/china-image-distribution --region china --sha256 <indexSha256> --commit <fullCommit>
# 确认输出后，显式增加 --publish；凭据只从 GH_TOKEN 或 GITHUB_TOKEN 环境变量读取。
```

`--publish` 固定发布到本仓库，先建草稿，上传并核对每个附件的大小和远端 SHA-256，所有附件齐全才公开。不会改变仓库的 latest Release。失败后重跑可续用完全相同的附件；不同内容、缺少哈希或未完成的 starter 附件会报错，工具不会删除或覆盖。存在覆盖诊断的包必须显式增加 `--allow-incomplete`，且始终作为 prerelease，不代表生产验收通过。元数据请求时限为 120 秒；256 MiB 附件流式上传单独允许 600 秒，避免正常低速上传被过早中断，仍保持单分片空间上限。

发布后的获取命令无需凭据；版本 ID 和索引哈希必须来自审核过的发布记录，不要从任意 URL 或 main 自动推断：

```sh
node scripts/fetch-images.mjs --region china --distribution <gad1-id> --sha256 <indexSha256> --directory /data/downloads/china-image-distribution --restore /data/ready/china-images
```

下载目录必须专用；可以续用同一固定版本的完整分块，冲突文件不覆盖。尚未下完的当前块重下，不使用未验哈希的断点字节；异常退出只清理本次创建的临时块，已通过校验的块保留。进程被强制结束可能遗留 `.image-download.lock`／`.part`，确认该目录没有下载进程后再人工处理，工具不会擅自清理未知文件。完整下载后逐文件复核，`--restore` 再执行完整 PNG 验证；恢复目录必须是新目录。预览包下载同样需要 `--allow-incomplete`。

下载前先核对全部已存在分块，只为缺失分块计算新增占用；损坏的后续分块会在任何新分块请求前报错，不覆盖原文件。目标磁盘须容纳剩余写入量并另留 2 GiB 空闲。使用 `--restore` 时，同一磁盘合计下载与恢复占用，不同磁盘分别检查；恢复也会在创建输出前检查空间和全部分块哈希。分块之间再次检查空间。这是预检，不是操作系统空间预留，不能替代调用方的工作区总预算；其它程序同时占满磁盘仍可能导致失败，恢复过程中失败的部分目录会保留，不自动清理未知文件。

下载不修改主项目配置、数据库或 active 指针。将恢复目录和图片 manifest 哈希显式配置到主项目对应区域的验收实例，仍需匹配结构化包的客户端身份。已发布版本见上表；后续版本是否可用以固定发布记录为准，不能从工具版本推断。

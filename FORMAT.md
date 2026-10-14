# 数据包格式

格式版本为 `1`。区域与语言是独立字段，不允许由语言推断区域，也不允许因为另一区域存在同名物品就认为可跨服复用。

## Manifest

`manifest.json` 包含 `schemaVersion`、`region`、`releaseId`、`collectorVersion`、`collectedAt`、`locales`、`capabilities`、`engineCompatibility`、`sources` 和 `files`。

- `sources`：来源类型、区域、语言、公开 URL 或本地结构化来源声明及哈希。不包含本地绝对路径。
- `files`：每个 JSON 文件的相对路径、字节数、SHA-256。`manifest.json` 不包含在自己的清单中；它的 SHA-256 位于区域 `latest.json`。
- `releaseId`：`gd1-` 加内容 SHA-256 前 24 位。计算时去掉 manifest 的 `releaseId`、`collectedAt`，递归按对象键排序、保留数组顺序，序列化为无空白 UTF-8 JSON 并在末尾添加一个 LF。
- `engineCompatibility`：原始包为 `REQUIRES_CANONICAL_ADAPTER_AND_MECHANICS_COVERAGE`；带统一查询模型的包为 `QUERY_ONLY_REQUIRES_TYPED_MECHANICS_ADAPTER`。两者均不得解释成战斗计算已兼容。

PublicExport 的清单是采集时读取的索引，不应以本机游戏 EXE 版本替代它。只有本地资源补充声明自己的 `clientBuild`。两个来源的版本差异要显式审阅，不能因为同在一个包里就推定一致。

## 官方导出信封

`exports/en/ExportWeapons.json` 示例结构：

```json
{
  "schemaVersion": 1,
  "region": "international",
  "locale": "en",
  "sourceId": "ExportWeapons",
  "sections": { "ExportWeapons": [] }
}
```

`sections` 保留源中的所有分类，不只取文件名对应的分类。数组顺序保留，记录的 `uniqueName` 是其来源内关联标识；没有唯一 ID 的记录不按显示名称强行合并。原始导出独立保存；跨语言查询表位于可选的 `canonical/`。

相同值的重复 JSON 属性会合并并写入质量报告；值不同的重复属性拒绝采集。官方字符串中的原始换行规范化为合法 JSON 转义，不改变文字含义。所有原始文件的哈希记录在 `sources`。

## 本地客户端事实

能力 `client-resource-facts-v1` 表示只读解析 Packages/Languages 后的白名单事实，不是 PublicExport 格式或完整战斗模型。`exports/en|zh/ExportClientItems.json` 的 `sections.ClientItems` 包含物品和继承链；`ExportClientLocalization.json` 仅包含被引用的文本标签。`exports/neutral/ExportClientResources.json` 的 `ownFacts` 保留字段路径与原始数值/枚举，父级另存，不合并数组或填充原生默认值。

`ExportClientCoverage.json` 和 `quality.clientCoverage` 给出具体缺口。未知类别、缺失语言保留 null，不能解释为默认手枪或回退到另一区域。缓存可能含隐藏/未开放物品，不能把清单作为游戏可获取列表。`completeResourceChain` 只说明资源父链可解析，不表示所有脚本、原生默认值与战斗行为已经实现。

`manifest.clientExtraction` 保存 TOC、压缩资源、解压资源哈希和解码计数。`clientBuild=packages-sha256-...` 是资源内容身份，不是游戏面板版本号。客户端来源各自独立，即使资源 ID 相同也不得跨区域覆盖。

## 紫卡和武器参数事实

能力 `client-riven-facts-v1` 表示 `ExportClientRivenProfiles`、`ExportClientWeaponParameters` 和 `ExportClientRivenCoverage` 三类文件同时存在。紫卡配置保留词条值、限制、显示舍入规则和字段继承来源；没有导出完整脚本、贴图或资源档案。`Value` 是原始升级数值，不是满级属性。

武器参数中的 `OmegaAttenuation` 与 Kitgun 的 `PrimaryOmegaAttenuation` 分别保留，后者不能误认作 Prime 参数。Zaw 打击部和 Kitgun 枪膛按实际资源基类识别，商店原始 `MiscItems` 分类不改写成普通武器。缺失值和来源均为 `null`，不使用其他区域、官方导出或猜测默认值填补。仍需类型适配、默认值核对和完整计算验收后才能宣称紫卡引擎可消费。

## 同区域来源组合

合包的 `inputs` 保存输入版本和 manifest SHA-256，`sources` 保留各来源。只接受同一区域，不同文件并存；同路径不同内容拒绝生成，禁止覆盖冲突。原查询投影被丢弃，合包后重新生成。

`sourceAlignment=INDEPENDENT_VERSIONS_NOT_MECHANICS_RECONCILED` 表示来源版本仍独立。官方索引与客户端资源哈希不能相互充当版本证明，同在一个包中也不允许默认用一方数值覆盖另一方。

## 统一查询模型

能力 `regional-catalog-v1` 和 `canonicalModel` 表示包中含以下只读查询投影：

- `canonical/entities-<分类小写>.json`：`entities` 数组。每项有 `key=section|id`、`section`、`id`、`names`、`variants`、`provenance`。`variants` 保留每种语言的源记录，`provenance` 指向原始文件、分类、数组下标及文件校验和。
- `canonical/relations.json`：按明确字段抽取的引用，包含源实体、语言、JSON Pointer、关系种类、原始和规范化目标 ID、候选实体及 `RESOLVED/UNRESOLVED/AMBIGUOUS`。仅对精确 `/Lotus/StoreItems/` 前缀进行资源 ID 转换，不按相似名称匹配。
- `canonical/coverage.json`：实体数、分类数、源记录数、未投影记录、完全重复记录、跨语言数值冲突、关系统计和逐功能支持状态。

覆盖报告中的 `dispositionReconciliation` 比较同 ID 的官方英文武器倾向性和客户端原始倾向性，保留两边值及客户端字段来源。`EXACT` 与 `SAME_F32`（转为 IEEE-754 单精度才一致）分别标注；缺失为 `CLIENT_UNKNOWN/OFFICIAL_UNKNOWN`，差异为 `CONFLICT`。它只报告，不覆盖数值，也不证明整个游戏机制版本一致。

所有文件保留 `schemaVersion=1`、区域和 `model=regional-catalog-v1`。分类与源 ID 联合确定实体；名称不充当 ID。完全相同的重复记录仅保留一份语言变体，但保留全部来源；冲突重复拒绝生成。缺失名称为 `null`，不合成跨语言或跨服回退。

`features.catalogQuery=AVAILABLE` 表示可查询这些实体，不表示所有源结构都已投影。无稳定 ID 或尚未适配的复合结构保留在原始导出，列于 `unidentified`。`rivenCalculation`、`automaticLoadout` 的支持状态必须分别检查，当前均为 `UNSUPPORTED_...`，不能直接作为战斗输入。`quality.status=PASS` 不覆盖这些能力限制。

## 已审核补充

`reviewed/*.json` 包含 `schemaVersion`、`region`、`provenance`、`data`。这是有边界的资源事实或规则，不是原程序文件或研究数据库。补充不会覆盖 `exports`，消费者必须检查来源版本和规则适用条件。

## 质量报告

`quality.json` 的 `status=PASS` 表示本次采集与文件级校验通过。`checks`、`warnings`、`limits` 说明具体检查范围；不表示已经游戏实测、实现了完整战斗模拟或可以直接切换生产。

## 发布和消费

`latest.json` 包含 `region`、`releaseId`、`manifest`、`manifestSha256`。`activation=DISCOVERY_ONLY_PIN_COMMIT_AND_MANIFEST_HASH` 表示它只是版本发现入口。校验失败、区域不匹配或能力不足必须拒绝导入，保留消费者已经启用的版本。

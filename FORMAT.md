# 数据包格式

格式版本为 `1`。区域与语言是独立字段，不允许由语言推断区域，也不允许因为另一区域存在同名物品就认为可跨服复用。

## Manifest

`manifest.json` 包含 `schemaVersion`、`region`、`releaseId`、`collectorVersion`、`collectedAt`、`locales`、`capabilities`、`engineCompatibility`、`sources` 和 `files`。

- `sources`：来源类型、区域、语言、公开 URL 或本地结构化来源声明及哈希。不包含本地绝对路径。
- `files`：每个 JSON 文件的相对路径、字节数、SHA-256。`manifest.json` 不包含在自己的清单中；它的 SHA-256 位于区域 `latest.json`。
- `releaseId`：`gd1-` 加内容 SHA-256 前 24 位。计算时去掉 manifest 的 `releaseId`、`collectedAt`，递归按对象键排序、保留数组顺序，序列化为无空白 UTF-8 JSON 并在末尾添加一个 LF。
- `engineCompatibility`：当前为 `REQUIRES_CANONICAL_ADAPTER_AND_MECHANICS_COVERAGE`，不得直接解释成任意版本引擎兼容。

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

`sections` 保留源中的所有分类，不只取文件名对应的分类。数组顺序保留，记录的 `uniqueName` 是其来源内关联标识；没有唯一 ID 的记录不按显示名称强行合并。此格式目前没有把不同语言记录物化为一个实体表，也不宣称完整跨源关系已经校验。

相同值的重复 JSON 属性会合并并写入质量报告；值不同的重复属性拒绝采集。官方字符串中的原始换行规范化为合法 JSON 转义，不改变文字含义。所有原始文件的哈希记录在 `sources`。

## 已审核补充

`reviewed/*.json` 包含 `schemaVersion`、`region`、`provenance`、`data`。这是有边界的资源事实或规则，不是原程序文件或研究数据库。补充不会覆盖 `exports`，消费者必须检查来源版本和规则适用条件。

## 质量报告

`quality.json` 的 `status=PASS` 表示本次采集与文件级校验通过。`checks`、`warnings`、`limits` 说明具体检查范围；不表示已经游戏实测、实现了完整战斗模拟或可以直接切换生产。

## 发布和消费

`latest.json` 包含 `region`、`releaseId`、`manifest`、`manifestSha256`。`activation=DISCOVERY_ONLY_PIN_COMMIT_AND_MANIFEST_HASH` 表示它只是版本发现入口。校验失败、区域不匹配或能力不足必须拒绝导入，保留消费者已经启用的版本。

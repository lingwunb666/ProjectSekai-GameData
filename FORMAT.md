# 数据包格式

格式版本为 `1`。区域与语言是独立字段，不允许由语言推断区域，也不允许因为另一区域存在同名物品就认为可跨服复用。

字典文件 `exports/<locale>/ExportClientDictionary.json` 可使用 `en,zh,de,es,fr,it,ja,ko,pl,pt,ru,tc,th,tr,uk`，每份仍必须通过本服精确缓存来源、计数、EOF 和语言清单验证；英中为基础必需项，额外字典不强制所有语言都已安装，也不表示该语言的实体视图已经实现。额外语言不放行任意 `Export*.json` 路径，`xx` 不作为翻译来源。此为验证器能力更新，已有固定版本仍未改变。

### 字典压缩与独立官方语言来源（1.61）

`ClientDictionary` 的 `client-dictionary-v2` 仅压缩 `entries`，不改变标签、空串、换行或格式标记。字段精确为 `schema,locale,entryCount,emptyCount,source,encoding,entriesBytes,entriesSha256,entriesGzip`；`encoding=gzip-base64-json-v1`。解码后的 UTF-8 JSON 对象最多 48 MiB，GZIP 最多 16 MiB，最多 250,000 条；必须验证单流、CRC、展开长度、SHA-256，拒绝拼接流和额外尾部。v1 仍可读取。整个数据包仍限制 512 MiB，压缩不是绕过展开量或语义校验。

额外语言的 `source.distribution` 可声明 `official-client-dictionary-v1`：固定本区域官方启动器分发索引的 URL／哈希／大小、采集元数据哈希、官方 EXE 的 MD5 版本标识、精确语言 TOC／cache 文件及下载／解码摘要。国际服仅 `content.warframe.com`，国服仅 `content-zhpt.wf.qq.com`；不能交叉使用。公开包不含原始客户端缓存或可执行文件。

其策略固定为 `EXACT_TAG_TEXT_ONLY_INDEPENDENT_VERSION`：仅按精确标签查询文本，不用于解析战斗数值，也不声称与本机 EXE 同版或更新。它不能覆盖英中基础字典，合包也不能覆盖任何已存在的语言。安装观察 `client-locale-inventory-v1` 保持原样：官方下载到法语字典与本机法语 `NOT_INSTALLED` 可以同时成立。来源哈希随不可变数据包固定，运行时不下载、不追随 latest、不以另一语言填空。

## Manifest

`manifest.json` 包含 `schemaVersion`、`region`、`releaseId`、`collectorVersion`、`collectedAt`、`locales`、`capabilities`、`engineCompatibility`、`sources` 和 `files`。

- `sources`：来源类型、区域、语言、公开 URL 或本地结构化来源声明及哈希。不包含本地绝对路径。
- `files`：每个 JSON 文件的相对路径、字节数、SHA-256。`manifest.json` 不包含在自己的清单中；它的 SHA-256 位于区域 `latest.json`。
- `releaseId`：`gd1-` 加内容 SHA-256 前 24 位。计算时去掉 manifest 的 `releaseId`、`collectedAt`，递归按对象键排序、保留数组顺序，序列化为无空白 UTF-8 JSON 并在末尾添加一个 LF。
- `engineCompatibility`：原始包为 `REQUIRES_CANONICAL_ADAPTER_AND_MECHANICS_COVERAGE`；带统一查询模型的包为 `QUERY_ONLY_REQUIRES_TYPED_MECHANICS_ADAPTER`。两者均不得解释成战斗计算已兼容。

PublicExport 的清单是采集时读取的索引，不应以本机游戏 EXE 版本替代它。只有本地资源补充声明自己的 `clientBuild`。两个来源的版本差异要显式审阅，不能因为同在一个包里就推定一致。

## 官方导出信封

### 同服文字图标（采集器 1.14.0）

能力 `client-text-icons-v1` 同时要求中立语言 `ExportClientTextIcons.json` 和 `ExportClientTextIconCoverage.json`。前者包括 `ClientTextIconCollections`／`ClientTextIconMaterials`：按客户端 GameConfig 选择图标与表情集合，保留完整 Icons／Platforms 原始数组、精确绑定指针与声明者。空槽保留；平台之间不隐式回退。

材质的 `resourceChain`、各层 `textureAttributes` 和最终 `textureFields` 必须一致；最近的显式空值同样覆盖父值。普通 Material 与 ProceduralMaterial 的属性头可解析，但二进制体只有哈希及 `NOT_INTERPRETED` 状态，不发布／执行着色器。缺失子层不允许将父纹理标为有效。

纹理身份可来自同代 H.Texture TOC，即使 Packages 没有对应行。`inventory.status=INDEX_ONLY_NOT_DECODED` 只证明索引登记，不代表已解码图片或材质最终渲染。独立验证器检查完整绑定、材质集合、属性所有者、空值覆盖、头部大小／哈希结构及覆盖计数；不是游戏内视觉验收。这些节是 RAW_ONLY，不自动变成游戏物品实体。

### 官方内容

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

## 官方 PC 掉落事实

能力 `official-pc-drop-tables-v1` 对应 `exports/en/ExportDropTables.json`。只允许 `international`；`en` 是官方页面语言，不是区域。其 `sections.OfficialDropTables` 包含 `formatVersion=1`、`publishedDate`、`sourceRowCount` 和 `tables`。来源记录保留官方入口、限定重定向、原始 HTML 哈希和字节数；HTML 本身不发布。

每个分类的 `direction` 区分 `SOURCE_TO_ITEM` 和 `ITEM_TO_SOURCE`；`groups` 保留 subject、rotation、stage、condition、sourceRow 与 entries。condition 明确区分首次和后续完成，不能覆盖父任务。正向的 poolGatePercent 在 group，反向在每个 entry；probabilityPercent 是官方公布的池内百分比，不是 0..1 值，不重算成合计 100%。门槛大于 100 的值标记为非单次概率；`underReview` 与显示 0.00% 不可解释为精确零。重复行保留，不把正反索引再次相加。

官方发布时间与 PublicExport／客户端内容身份独立。文件级 PASS 说明采集与完整性检查通过，不表示奖励 ID 都已唯一关联、完全覆盖热修复或已可替换所有业务读取。国服不能引用或改标签复用此来源。

## 本地客户端事实

能力 `client-resource-facts-v1` 表示只读解析 Packages/Languages 后的白名单事实，不是 PublicExport 格式或完整战斗模型。`exports/en|zh/ExportClientItems.json` 的 `sections.ClientItems` 包含物品和继承链；`ExportClientLocalization.json` 仅包含被引用的文本标签。`exports/neutral/ExportClientResources.json` 的 `ownFacts` 保留字段路径与原始数值/枚举，父级另存，不合并数组或填充原生默认值。

`ExportClientCoverage.json` 和 `quality.clientCoverage` 给出具体缺口。未知类别、缺失语言保留 null，不能解释为默认手枪或回退到另一区域。缓存可能含隐藏/未开放物品，不能把清单作为游戏可获取列表。`completeResourceChain` 只说明资源父链可解析，不表示所有脚本、原生默认值与战斗行为已经实现。

`manifest.clientExtraction` 保存 TOC、压缩资源、解压资源哈希和解码计数。`clientBuild=packages-sha256-...` 是资源内容身份，不是游戏面板版本号。客户端来源各自独立，即使资源 ID 相同也不得跨区域覆盖。

## 紫卡和武器参数事实

能力 `client-riven-facts-v1` 表示 `ExportClientRivenProfiles`、`ExportClientWeaponParameters` 和 `ExportClientRivenCoverage` 三类文件同时存在。紫卡配置保留词条值、限制、显示舍入规则和字段继承来源；没有导出完整脚本、贴图或资源档案。`Value` 是原始升级数值，不是满级属性。

武器参数中的 `OmegaAttenuation` 与 Kitgun 的 `PrimaryOmegaAttenuation` 分别保留，后者不能误认作 Prime 参数。Zaw 打击部和 Kitgun 枪膛按实际资源基类识别，商店原始 `MiscItems` 分类不改写成普通武器。缺失值和来源均为 `null`，不使用其他区域、官方导出或猜测默认值填补。仍需类型适配、默认值核对和完整计算验收后才能宣称紫卡引擎可消费。

## 同区域来源组合

合包的 `inputs` 保存输入版本和 `contentSha256`，算法与版本身份相同但保留完整 64 位十六进制哈希，不含 `releaseId/collectedAt`。这使相同输入的重复采集不因时间变化而产生新版本。早期包的 `manifestSha256` 仍用于核对当时的完整 manifest 字节，不改写历史包。`sources` 保留各来源。只接受同一区域，不同文件并存；同路径不同内容拒绝生成，禁止覆盖冲突。原查询投影被丢弃，合包后重新生成。

`sourceAlignment=INDEPENDENT_VERSIONS_NOT_MECHANICS_RECONCILED` 表示来源版本仍独立。官方索引与客户端资源哈希不能相互充当版本证明，同在一个包中也不允许默认用一方数值覆盖另一方。

## 统一查询模型

采集器 1.20.0 写入 `regional-catalog-v5`。实体分片声明 `entityEncoding=shared-provenance-v1`，以分片内 `sources` 数组共享 `{path,section,locale,sha256}`；最多 512 个来源／2,000 个实体。每个实体的 `provenance` 是有序 `[sourceIndex, recordIndex]` 元组数组，`variantSources` 是语言到该实体 provenance 索引的映射。名字、说明、身份和原始 exports 不变。恢复后仍必须逐条对照原文件的哈希、区域、语言、记录身份和标签，不能仅以索引在范围内判定有效。拒绝重复／未引用来源、越界索引、错误语言及未知编码；同来源文件不同记录行保留，不去掉重复记录证据。关系仍使用 v4 编码。读取器兼容 v1–v4；旧读取器必须拒绝 v5 而非猜读。

`canonicalModel` 标明只读查询模型版本，当前写入 `regional-catalog-v3`，读取器继续支持历史 v1/v2：

- `canonical/entities-<分类小写>[-序号].json`：`entities` 数组。每项有 `key=section|id`、`section`、`id`、`names`、`descriptions`、`variantSources`、`provenance`。v3 不重复保存原始记录；`variantSources[locale]` 指向原始导出文件的 `path/sha256/section/index/locale`，全部原始字段只存放在 `exports`。完全重复的记录仍保留全部 `provenance`。旧 v1/v2 的 `variants` 为内嵌完整记录。
- `canonical/relations*.json`：按明确字段抽取的引用，包含源实体、语言、JSON Pointer、关系种类、原始和规范化目标 ID、候选实体及 `RESOLVED/UNRESOLVED/AMBIGUOUS`。优先精确 ID，否则仅使用显式且唯一的商店到物品映射，不裁剪路径前缀或按相似名称猜测。
- `canonical/coverage.json`：实体数、分类数、源记录数、未投影记录、完全重复记录、跨语言数值冲突、关系统计和逐功能支持状态。

覆盖报告中的 `dispositionReconciliation` 比较同 ID 的官方英文武器倾向性和客户端原始倾向性，保留两边值及客户端字段来源。`EXACT` 与 `SAME_F32`（转为 IEEE-754 单精度才一致）分别标注；缺失为 `CLIENT_UNKNOWN/OFFICIAL_UNKNOWN`，差异为 `CONFLICT`。它只报告，不覆盖数值，也不证明整个游戏机制版本一致。

所有文件保留 `schemaVersion=1`、区域和对应的 `model`。分类与源 ID 联合确定实体；名称不充当 ID。完全相同的重复记录仅保留一份语言变体，但保留全部来源；冲突重复拒绝生成。缺失名称为 `null`，不合成跨语言或跨服回退。1.9.0 的 v3 写入每片最多 2,000 条／8 MiB，早先 v2/v3 为 1,000 条；完整包仍不超过 512 文件／384 MiB。消费者必须读取全部实体分片及 `coverage.relationFiles` 指定的全部关系分片，不把记录数当固定文件布局。单条超大记录拒绝发布，不截断。

v3 校验除文件哈希外，还核对定位引用的区域、语言、分类、下标、源身份和名称／描述。仅修改引用并重算 manifest 不能把另一项冒充为原项。查询原始详情时由引用恢复记录；语义差异比较恢复后的字段，文件哈希或数组位置变动本身不算游戏数值变更。

`features.catalogQuery=AVAILABLE` 表示可查询这些实体，不表示所有源结构都已投影。无稳定 ID 或尚未适配的复合结构保留在原始导出，列于 `unidentified`。`rivenCalculation`、`automaticLoadout` 的支持状态必须分别检查，当前均为 `UNSUPPORTED_...`，不能直接作为战斗输入。`quality.status=PASS` 不覆盖这些能力限制。

采集器 1.9.0 可提供 `ClientItemIdentities` 中立身份表：`uniqueName` 为原生 `TypeName`，`identityRule=explicit-store-typename-v1`，`storeItems` 保存全部显式映射到它的商店资源 ID。必须与同包全部 `ClientInventory*` 记录的 `uniqueName/typeName` 分组精确一致，不能靠名称或路径裁剪生成。它是内部关系定位项，不应重复展示为搜索命中；其候选关系使用 `targetRule=explicit-store-typename-v1`，避免同一物品的多个分类视图被误判为不同物品。不同 `TypeName` 的冲突仍保留，属性差异仍报告。缺此表的历史包按原有语义读取。

原生商店关系分别保留商品、材料价格、折前价格和随机货币池候选；原始数量、范围和轮换控制不变，不表示当前在售库存。集团／遗物清单可携带声明作用域引用，包含原始值、声明资源、解析目标和状态；未解析引用不删除。`ClientBundles` 保留实际礼包组成，`ClientAvionics` 限定航电 MOD 家族，`ClientModSets` 保留明确套装链接产生的成员与原始效果。它们不表示脚本机制或最终概率已经计算完成。

1.9.1 对已存在同包且声明作用域校验通过的 `ClientRecipes`，只从真实制作定义抽取制作边；其 `ClientInventoryRecipes` 商店视图保留 `TypeName` 身份边及全部原始字段，不再次把展示字段解释为另一份制作配方。没有有效原生定义时仍保留诊断引用，不借此删除缺失记录。身份表校验还检查顶层 `typeName` 与原始 `values.TypeName` 一致且有声明资源。

## 已审核补充

1.17.0 写入 `regional-catalog-v4`，实体部分与 v3 相同，关系分片声明 `relationEncoding=target-identity-elision-v1`。仅压缩已证明相同的身份字符串：省略的 `targetId` 精确等于 `rawTarget`；`candidateSections` 按原候选顺序保存分类名，完整候选键为 `section + "|" + targetId`。不同目标的歧义证据、上下文、字段路径、原始值及所有关联均保留。未知编码必须拒绝；读取器继续兼容 v1/v2/v3，不能把 v4 当作缺失 candidates 的旧记录。原始 exports 不因索引优化而改变。

1.15.1 的 `ClientChallengeDefinitions` 在 neutral 保存原生条件，`ClientChallengeLocalization` 仅保存语言标签／文本；`ClientAchievements` 是原生管理器的有序启用清单，不是完成记录。`Parents` 为完成／事件关联，不是类继承。缺省计数和默认语言名未证明时保持未知。

`native-declaration-scope-v2` 扩展到集团季节、等级奖励、地形任务、成就启用及完成前置等嵌套引用；每条引用保留 pointer、声明者、原始值和目标。v1 包的旧引用范围不被追溯要求包含 v2 新字段。`ClientTilesets` 只表示原生任务配置，不包含三维地图模拟或实时任务状态。

1.16.0 新增 `ClientItemParents`：从本服完整商店 TypeName 的真实父类链选取，不使用外部虚拟物品名单。中立元数据保存父类、原始父引用和字段声明者；语言文件单独保存 `ClientItemParentLocalization`。图必须闭合且无环，字段来源必须在链内，语言标签须与中立定义一致；普通物品分类不因也充当父类而被覆盖。它不是可获取物品列表。

`ClientLoreFragments` 保留精确 `LoreFragment` 家族的扫描次数、类型、歌曲、战甲、图片及传讯引用；全字段声明者与同服翻译分开保存。缺失 `FragmentType` 不猜成默认类型；未解出的二进制 Codex 清单成员不伪造。此分类维持 RAW_ONLY，不额外制造搜索实体。新版本结构不自动代表已生产启用。

1.13.0 的 `ClientWeapons` 补充光束接收者的原始字段：连锁次数、顺序／分叉标志、距离、伤害衰减、格挡控制、目标类型过滤、命中回调引用，以及发射端的范围、锁定和弹射参数。`Behaviors` 仍以最近完整数组声明为来源，不跨层补字段；显式零／空值保留，未序列化项为 null。只携带回调资源引用及参数，不包含脚本代码。存在这些字段不代表任意光束已获得引擎支持；消费方必须核对具体身份、类和全部条件，不能只校验面板伤害。

1.12.0 仅对通过完整 `ClientItemIdentities` 证明的商店输入，把派生 `typeName` 与原始 `values.TypeName` 的同一身份关系合为 `/typeName` 一条。证明已核对完整成员、两处值一致及声明资源；两个原始字段和中英文上下文均保留。没有该证明的历史包仍按原规则保留两条，不靠相似名称或路径推断。文件格式仍为 v3，关系数量变化不是删掉物品或原始信息。

1.11.0 的 artifact JSON 可采用紧凑 UTF-8 排版（排序对象键、保留数组顺序与全部值、LF 结尾）；读取器不得依赖空白、行数或缩进。manifest 可保留排版，原来的漂亮排版包仍可校验。`ClientCreditBundles/ClientFusionBundles/ClientDrones/ClientAnimals` 保留精确原生家族和整字段来源，缺省值仍未知，原始价格或奖励权重不自动等于最终奖励数值。保育 `HuntingInfo` 是原生最近整字段声明，不是任意深合并后的完整运行状态；其 `CONSERVATION_TAG_REWARD/CONSERVATION_WOUNDED_REWARD` 引用按声明作用域解析，缺失目标继续保留。

1.10.0 的 `ClientDojoRecipes` 为中立记录，使用 `selectionRule=dojo-manifest-class-v1`，必须属于同包 `ClientDatafiles` 中精确的 `DojoRecipeManifest.RecipeItems`。`familyRoot` 为解析后的原生类，`roles` 可包含 `ROOMS/DECOS/COLOURS/BACKDROPS` 及由显式标志产生的 `RESEARCH/FABRICATIONS`。多角色不是多个物品，也不能只选一项覆盖其它用途。`values` 稀疏保留原生字段，`fieldSources` 指向整字段声明资源，`localizations` 保存本服各语言标签；不跨服补齐。研究与建造的成本、时间、加速和材料数组分开，研究材料关系为 `DOJO_RESEARCH_INGREDIENT`。结果资产、前置条件分组及氏族规模控制字段保持原始语义，不当作物品或默认倍率。`ClientDojoCoverage` 列出缺失成员和链接，不作为实体。

`reviewed/*.json` 包含 `schemaVersion`、`region`、`provenance`、`data`。这是有边界的资源事实或规则，不是原程序文件或研究数据库。补充不会覆盖 `exports`，消费者必须检查来源版本和规则适用条件。

## NPC 原生声明图

`client-npc-facts-v1` 要求 `exports/neutral/ExportClientNpc.json` 和 `ExportClientNpcCoverage.json` 两份文件。覆盖报告编码为 `native-npc-owned-values-v1`。`ClientNpcAgents`、`ClientNpcAvatars`、`ClientNpcDamageControllers`、`ClientNpcHitProxies` 保存成员身份与选择规则；化身附同服 `en/zh` 名字和说明，缺译为 null。数量包含友方、辅助项及基类，不表示刷出或图鉴可用性。

`ClientNpcResources` 每个原生声明只存一次，包含 `uniqueName`、已解析 `parentName`、实际消费的 `values` 和声明作用域 `references`。父图必须完整、无环、深度小于 100，全部资源必须可由成员到达。读取某字段时从成员沿父图取最近一次完整声明；未出现的字段未知，不能填 0，显式 0／空数组覆盖父值，不能深度合并。`coverage.fields` 列出各类型字段清单；资源值必须属于此清单。

本节 `references.owner` 必须等于所属声明的 `uniqueName`，不再重复保存恒等的 `fieldSources`。指针指向同条声明的 `/values/...`，原始值、解析状态、缺失链接和计数均校验。未解决的重名／缺失客户端资源保留诊断；掉落表及 AI 武器引用不代表其内容或计算已接入。原生默认值、等级缩放和减伤公式不由此格式推断。

## NPC 携带物与武器事实

`client-ai-weapon-facts-v1` 要求同包 NPC 声明图、`ExportClientAiWeapons.json` 和 `ExportClientAiWeaponCoverage.json`，均在 `exports/neutral`。清单只来自 Agent 的已解析 `NewAdditionalInventory/*/item` 引用；清单身份缺失必须有诊断，不能静默漏项。`ClientAiInventory` 记录父链与原生根类，分 `WEAPON`／`OTHER_ITEM`。后者不填造武器伤害。

`ClientAiWeapons` 保留参数及其字段声明者，`behaviorOwner` 引用 `ClientAiWeaponBehaviors` 的完整数组；null 表示未序列化，显式空数组单独保留。每个行为的 `source` 必须对应所属声明及索引。弹体绑定保留 `uniqueName`、`reference`、`referenceOwner`，必须与发射组件一致；事实保存在 `ClientAiProjectiles`，不能将相同弹体的不同相对引用作用域混合。

弹体使用 `native-projectile-unknown-fields-v1` 可逆编码：`ClientAiUnknownFields` 保存重复的未知字段路径；按 `unknownFields` 恢复 `values`／各 `attacks` 的 null，以及 `fieldSources` 的 null。未知路径只能补原本缺失的位置，不能覆盖任何显式值／来源；还原后必须符合 `native-projectile-facts-v2` 的字段所属父链和完整源字段集合。全部共享行为、弹体、未知字段组均必须被引用，计数独立校验。

以上是原生事实，不是玩家配卡候选或最终等级伤害。脚本仅保存引用，不执行；等级缩放、敌方准确率、AI 调度、额外异常／脚本伤害不由本节推断。

## 内源之力（1.22–1.23）

`client-intrinsic-tables-v1` 对应中立 `ClientIntrinsicTables`，固定同服两份源脚本的哈希和 `PlayerSkill` 原生枚举来源。`values` 包含九个 effect category、50 个符号及按枚举身份绑定的九分支。每分支有 1–10 级；炮术另有显式 0 级。升级项按原数组顺序保存，未知字段保持缺失，浮点是客户端 binary32 字面值；资源构造器／原生常量用带类型的符号引用表达。不得据此执行脚本或把空等级视为没有其它原生效果。

`client-intrinsic-ui-v1` 包含中立 `ClientIntrinsicUiHeaders`、`ClientIntrinsicUi`、`ClientIntrinsicUiCoverage`，及 en/zh `ClientIntrinsicLocalization`。头部来源为 H.AnimRetarget，校验 UI 脚本指纹、原始并行数组、技能身份／顺序、图标与视频相对引用和 90 级 PC 标签绑定；渲染正文不投影。名称／说明按本服语言保存，缺失 null、原始占位符不跨语言补齐。语言文本不作为升级数值来源。

原始说明保留 `descriptionTemplate`。消费端可以使用已核验的 PC 显示规则填入同一包等级升级项的 `VALn`，但不能将显示舍入值当作伤害运算值；输入图标依赖玩家配置。新脚本哈希不匹配时拒绝生成／接受未审核规则的新包，不撤销既有固定包。

## 质量报告

`quality.json` 的 `status=PASS` 表示本次采集与文件级校验通过。`checks`、`warnings`、`limits` 说明具体检查范围；不表示已经游戏实测、实现了完整战斗模拟或可以直接切换生产。

## 发布和消费

`latest.json` 包含 `region`、`releaseId`、`manifest`、`manifestSha256`。`activation=DISCOVERY_ONLY_PIN_COMMIT_AND_MANIFEST_HASH` 表示它只是版本发现入口。校验失败、区域不匹配或能力不足必须拒绝导入，保留消费者已经启用的版本。

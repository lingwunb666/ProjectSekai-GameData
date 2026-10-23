// Independent publication allowlist. Each version still needs own-release acquisition proof.
export const CUSTOM_MOD_SOURCE_VERSIONS = Object.freeze({
  'augment-ninja-storm': {bytes:38892,sha256:'a4895b8b5a0a36e2dd2ac80935fe395e9f6b97f92a71fc303ec7f5cfb7526fdc'},
  'augment-harlequin-object-change': {bytes:78692,sha256:'f948907493ecd255daa054f5bccfc789ccae9fa8fcd40f7281e5a3a0b8a6c411'},
  'augment-dragon-breath': {bytes:23530,sha256:'4021381dfbf240d40612bcbb0b351ec12112198fef9ece08c360aaf009e63118'},
  'augment-wormhole': {bytes:20727,sha256:'c8f3e64a4f62abd674296674b0c9d8f71fea7452f16c6e0cc40f229da2006243'},
  'augment-saryn-weapon-poison': {bytes:11026,sha256:'638e1acba3480ce7bb2cca3679a5bada082359568c599ba4c6c8293bdf7886d4'},
  'augment-volt-shield': {bytes:24671,sha256:'6e6512ce95b19373f2c0937f7a4ca895eb957dc266b615bd203156e53d207914'},
  'augment-yareli-board': {bytes:35623,sha256:'7627b6dc0ecfa442fd1299de8e117b60a489d9d870c3af776c4a672630d5b584'},
  'augment-loki-switch': {bytes:18128,sha256:'1f0f2ff15cf2b8160e52010c3e5dff9b5a5d034df1b3c9eca937e3a4372497a8'}
});
export function reviewedCustomModSource(spec,source) {
  return [spec,CUSTOM_MOD_SOURCE_VERSIONS[spec.id]].some(v=>v&&source?.bytes===v.bytes&&source.decodedSha256===v.sha256);
}

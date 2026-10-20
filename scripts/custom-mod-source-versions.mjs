// Independent publication allowlist. Each version still needs own-release acquisition proof.
export const CUSTOM_MOD_SOURCE_VERSIONS = Object.freeze({
  'augment-ninja-storm': {bytes:38892,sha256:'a4895b8b5a0a36e2dd2ac80935fe395e9f6b97f92a71fc303ec7f5cfb7526fdc'},
  'augment-harlequin-object-change': {bytes:78692,sha256:'f948907493ecd255daa054f5bccfc789ccae9fa8fcd40f7281e5a3a0b8a6c411'},
  'augment-dragon-breath': {bytes:23530,sha256:'4021381dfbf240d40612bcbb0b351ec12112198fef9ece08c360aaf009e63118'},
  'augment-wormhole': {bytes:20727,sha256:'c8f3e64a4f62abd674296674b0c9d8f71fea7452f16c6e0cc40f229da2006243'}
});
export function reviewedCustomModSource(spec,source) {
  return [spec,CUSTOM_MOD_SOURCE_VERSIONS[spec.id]].some(v=>v&&source?.bytes===v.bytes&&source.decodedSha256===v.sha256);
}

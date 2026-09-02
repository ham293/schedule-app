/** 返回 VAPID 公钥，供前端订阅推送时使用 */
const lib = require('./_lib');

module.exports = (req, res) => {
  lib.json(res, 200, { publicKey: lib.PUBLIC_KEY });
};

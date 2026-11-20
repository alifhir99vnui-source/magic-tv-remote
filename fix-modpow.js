const fs = require("fs");
const pkgPath = "package.json";
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
pkg.scripts = pkg.scripts || {};
const cmd = "node fix-modpow.js";
if (!pkg.scripts.postinstall || !pkg.scripts.postinstall.includes("fix-modpow.js")) {
  pkg.scripts.postinstall = pkg.scripts.postinstall ? pkg.scripts.postinstall + " && " + cmd : cmd;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
}
const gradlePath = "node_modules/react-native-modpow/android/build.gradle";
if (fs.existsSync(gradlePath)) {
  const updated = fs.readFileSync(gradlePath, "utf8").replace(/jcenter\(\)/g, "mavenCentral()");
  fs.writeFileSync(gradlePath, updated);
  console.log("Updated react-native-modpow build.gradle");
}

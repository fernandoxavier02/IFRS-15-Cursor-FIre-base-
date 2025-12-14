/**
 * Firebase Setup Verification Script
 * 
 * Verifica se todas as configurações do Firebase estão corretas antes de testar.
 * 
 * Usage: npx tsx scripts/check-firebase-setup.ts
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: CheckResult[] = [];
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function check(name: string, condition: boolean, message: string) {
  results.push({ name, passed: condition, message });
  const icon = condition ? "✓" : "✗";
  console.log(`${icon} ${name}: ${message}`);
}

console.log("=".repeat(60));
console.log("Firebase Setup Verification");
console.log("=".repeat(60));
console.log("");

// 1. Check firebase.json
const firebaseJsonPath = path.join(projectRoot, "firebase.json");
check(
  "firebase.json exists",
  fs.existsSync(firebaseJsonPath),
  firebaseJsonPath
);

if (fs.existsSync(firebaseJsonPath)) {
  try {
    const firebaseJson = JSON.parse(fs.readFileSync(firebaseJsonPath, "utf-8"));
    check(
      "firebase.json has firestore config",
      !!firebaseJson.firestore,
      "Firestore configured"
    );
    check(
      "firebase.json has functions config",
      !!firebaseJson.functions,
      "Functions configured"
    );
    check(
      "firebase.json has hosting config",
      !!firebaseJson.hosting,
      "Hosting configured"
    );
    check(
      "firebase.json has emulators config",
      !!firebaseJson.emulators,
      "Emulators configured"
    );
  } catch (error: any) {
    check("firebase.json is valid JSON", false, error.message);
  }
}

// 2. Check .firebaserc
const firebasercPath = path.join(projectRoot, ".firebaserc");
check(
  ".firebaserc exists",
  fs.existsSync(firebasercPath),
  firebasercPath
);

if (fs.existsSync(firebasercPath)) {
  try {
    const firebaserc = JSON.parse(fs.readFileSync(firebasercPath, "utf-8"));
    check(
      ".firebaserc has default project",
      !!firebaserc.projects?.default,
      `Project: ${firebaserc.projects?.default || "missing"}`
    );
  } catch (error: any) {
    check(".firebaserc is valid JSON", false, error.message);
  }
}

// 3. Check firestore.rules
const firestoreRulesPath = path.join(projectRoot, "firestore.rules");
check(
  "firestore.rules exists",
  fs.existsSync(firestoreRulesPath),
  firestoreRulesPath
);

// 4. Check functions directory
const functionsPath = path.join(projectRoot, "functions");
check(
  "functions directory exists",
  fs.existsSync(functionsPath),
  functionsPath
);

// 5. Check functions/package.json
const functionsPackageJsonPath = path.join(functionsPath, "package.json");
check(
  "functions/package.json exists",
  fs.existsSync(functionsPackageJsonPath),
  functionsPackageJsonPath
);

if (fs.existsSync(functionsPackageJsonPath)) {
  try {
    const functionsPackageJson = JSON.parse(
      fs.readFileSync(functionsPackageJsonPath, "utf-8")
    );
    check(
      "functions has firebase-admin",
      !!functionsPackageJson.dependencies?.["firebase-admin"],
      "firebase-admin dependency found"
    );
    check(
      "functions has firebase-functions",
      !!functionsPackageJson.dependencies?.["firebase-functions"],
      "firebase-functions dependency found"
    );
    check(
      "functions has build script",
      !!functionsPackageJson.scripts?.build,
      "Build script configured"
    );
  } catch (error: any) {
    check("functions/package.json is valid JSON", false, error.message);
  }
}

// 6. Check functions/src/index.ts
const functionsIndexPath = path.join(functionsPath, "src", "index.ts");
check(
  "functions/src/index.ts exists",
  fs.existsSync(functionsIndexPath),
  functionsIndexPath
);

// 7. Check functions/tsconfig.json
const functionsTsconfigPath = path.join(functionsPath, "tsconfig.json");
check(
  "functions/tsconfig.json exists",
  fs.existsSync(functionsTsconfigPath),
  functionsTsconfigPath
);

// 8. Check client firebase config
const clientFirebasePath = path.join(
  projectRoot,
  "client",
  "src",
  "lib",
  "firebase.ts"
);
check(
  "client/src/lib/firebase.ts exists",
  fs.existsSync(clientFirebasePath),
  clientFirebasePath
);

if (fs.existsSync(clientFirebasePath)) {
  const firebaseConfigContent = fs.readFileSync(clientFirebasePath, "utf-8");
  check(
    "firebase.ts has emulator connection",
    firebaseConfigContent.includes("connectAuthEmulator") ||
      firebaseConfigContent.includes("VITE_USE_FIREBASE_EMULATORS"),
    "Emulator connection configured"
  );
}

// 9. Check .env.example
const envExamplePath = path.join(projectRoot, ".env.example");
check(
  ".env.example exists",
  fs.existsSync(envExamplePath),
  envExamplePath
);

// 10. Check firestore-service.ts
const firestoreServicePath = path.join(
  projectRoot,
  "client",
  "src",
  "lib",
  "firestore-service.ts"
);
check(
  "firestore-service.ts exists",
  fs.existsSync(firestoreServicePath),
  firestoreServicePath
);

if (fs.existsSync(firestoreServicePath)) {
  const serviceContent = fs.readFileSync(firestoreServicePath, "utf-8");
  check(
    "firestore-service has ifrs15Service",
    serviceContent.includes("ifrs15Service"),
    "IFRS 15 service found"
  );
  check(
    "firestore-service has reportsService",
    serviceContent.includes("reportsService"),
    "Reports service found"
  );
}

// Print summary
console.log("");
console.log("=".repeat(60));
console.log("Verification Summary");
console.log("=".repeat(60));

const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;

console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${results.length}`);

if (failed > 0) {
  console.log("\nFailed checks:");
  results
    .filter((r) => !r.passed)
    .forEach((r) => {
      console.log(`  - ${r.name}: ${r.message}`);
    });
  console.log("\n⚠️  Please fix the failed checks before testing.");
  process.exit(1);
} else {
  console.log("\n✅ All checks passed! Ready to test.");
  console.log("\nNext steps:");
  console.log("  1. npm install (if not done)");
  console.log("  2. cd functions && npm install (if not done)");
  console.log("  3. npm run firebase:emulators");
  console.log("  4. npm run dev (in another terminal)");
  process.exit(0);
}

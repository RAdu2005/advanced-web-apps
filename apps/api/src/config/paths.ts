import path from "path";

function resolveApiRootDir(): string {
  const cwd = process.cwd();
  const runningInsideApiWorkspace = path.basename(cwd) === "api" && path.basename(path.dirname(cwd)) === "apps";

  if (runningInsideApiWorkspace) {
    return cwd;
  }

  return path.resolve(cwd, "apps", "api");
}

export const apiRootDir = resolveApiRootDir();
export const projectRootDir = path.resolve(apiRootDir, "..", "..");
export const avatarUploadDir = path.join(apiRootDir, "uploads", "avatars");
export const defaultUserIconPath = path.join(projectRootDir, "user_icon.png");

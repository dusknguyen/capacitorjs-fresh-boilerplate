export interface CustomConfig {
  key?: string;
  github?: {
    // GitHub repository configuration
    owner?: string; // Owner of the repository
    repo?: string; // Repository name
    private?: boolean; // Is the repo private?
    token?: string; // Access token for private repos
  };
}
// Reads and merges app configuration from a JSON file
export function getCustomConfig(): CustomConfig {
  return {
    github: {
      owner: null,
      repo: null,
      private: false,
      token: null,
    },
  };
}

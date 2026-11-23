import { DATA_PATHS, getDataFilePath } from '../../../src/constants';

/**
 * Scripts path constants
 * Re-export from centralized data paths for consistency
 */
export const SCRIPTS_PATHS = {
  // Data folder path relative to scripts folder
  DATA_DIR: DATA_PATHS.DATA_DIR,
  
  // Specific script data files
  PROJECTS_FILE: DATA_PATHS.PROJECTS_FILE
} as const;

/**
 * Helper function to get scripts data file path
 * @param filename - The filename in the data directory
 * @returns Full path to the scripts data file
 */
export function getScriptsDataFilePath(filename: string): string {
  return getDataFilePath(filename);
} 
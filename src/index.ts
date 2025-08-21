import { logger, type IAgentRuntime, type Project, type ProjectAgent } from '@elizaos/core';
import createGoatPlugin from '@elizaos/plugin-goat';
import EnhancedStakingManagerPlugin from './plugin.ts';
import { character } from './character.ts';

// Helper function to get secrets from character or environment
function getSecret(character: any, secret: string) {
  return character.settings?.secrets?.[secret] || process.env[secret];
}

const initCharacter = async ({ runtime }: { runtime: IAgentRuntime }) => {
  logger.info('Initializing character');
  logger.info(`Name: ${character.name}`);
  
  // Validate that we have the required EVM private key
  const privateKey = getSecret(character, "EVM_PRIVATE_KEY");
  if (!privateKey) {
    logger.warn('EVM_PRIVATE_KEY not found. GOAT plugin functionality will be limited.');
  } else {
    logger.info('EVM_PRIVATE_KEY found, GOAT plugin will be fully functional');
  }
};

// export const projectAgent: ProjectAgent = {
//   character,
//   init: async (runtime: IAgentRuntime) => await initCharacter({ runtime }),
//  plugins: [
//     EnhancedStakingManagerPlugin, 
//   ]
// };
// const project: Project = {
//   agents: [projectAgent],

// };

export const projectAgent: ProjectAgent = {
  character,
  init: async (runtime: IAgentRuntime) => await initCharacter({ runtime }),
  plugins: [
    EnhancedStakingManagerPlugin,
    // Create GOAT plugin conditionally and pass the getSecret function
    ...(getSecret(character, "EVM_PRIVATE_KEY") ? [
      await createGoatPlugin((secret: string) => getSecret(character, secret))
    ] : [])
  ]
};
const project: Project = {
  agents: [projectAgent],
};

export { testSuites } from './__tests__/e2e';
export { character } from './character.ts';
export default project;
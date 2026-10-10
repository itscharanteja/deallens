import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/next-env.d.ts', '**/tsconfig.tsbuildinfo'] },
  ...tseslint.configs.recommended,
  { files: ['**/*.ts', '**/*.tsx'], rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] } },
);

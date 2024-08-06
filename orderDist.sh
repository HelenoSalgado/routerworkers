# /bin/bash

INDEX_TYPES=./dist/index.d.ts;

# Cria arquivo principal
touch $INDEX_TYPES;

# Reune todos os tipos num arquivo principal
cat "./dist/types/index.d.ts" > $INDEX_TYPES;
cat "./dist/src/index.d.ts" >> $INDEX_TYPES;

# Remove diretórios não usados
rm -rf "./dist/src" 
rm -rf "./dist/types"

# Remove importação de tipos
sed -i "/import/d" $INDEX_TYPES;

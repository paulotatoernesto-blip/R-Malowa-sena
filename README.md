# R-MALOWA SENA 2.0 — pacote inicial

Este pacote acrescenta o módulo **RELATÓRIO DE CAMPO** à aplicação web existente e prepara as tabelas de apoio no Supabase sem apagar `groups`, `members`, `pays` ou `profiles`.

## Ficheiros
- `field-report.js` — módulo de registo e resumo mensal por grupo/categoria.
- `supabase-migration.sql` — cria a tabela `field_reports` e políticas de acesso.
- `INSTRUCOES.txt` — passos de instalação e teste.

## Decisão funcional importante
Os relatórios de campo são registados por **grupo e categoria**, não por pessoa:
- Pioneiros regulares
- Pioneiros auxiliares
- Publicadores

As horas e os estudos dirigidos são somados automaticamente por grupo, categoria, mês e ano. O formulário pede o total do grupo para cada categoria; não cria uma classificação individual dos membros.

## Antes de publicar
1. Faça uma cópia de segurança do repositório e da base de dados.
2. No Supabase, execute `supabase-migration.sql` no SQL Editor.
3. Mantenha o `config.js` que já existe no repositório. Não cole aqui uma chave `sb_secret_` ou `service_role`.
4. Integre `field-report.js` conforme `INSTRUCOES.txt`.
5. Teste com dois utilizadores autorizados antes de usar dados reais.

A aplicação ainda precisa de validação no projeto Supabase real, porque a estrutura detalhada das colunas de `profiles`, `groups`, `members` e `pays` depende da configuração existente.

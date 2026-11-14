# Floresta em Pé — Joinville/SC

Protótipo educativo de registro de ocorrências ambientais em Joinville, Santa Catarina.

## Executar

1. Instale o **Node.js 18 ou superior**.
2. No terminal, dentro da pasta do projeto, execute `npm start` (ou `node server.js`).
3. Abra **http://localhost:3000** no navegador.

**Não abra o `index.html` diretamente como arquivo:** o salvamento agora depende do servidor Node. Nenhuma dependência npm precisa ser instalada.

## Funcionalidades

- Cadastro de denúncias apenas de **Joinville/SC**, validado no formulário **e no servidor**.
- Campo obrigatório de **endereço** e campo opcional de ponto de referência.
- Mapa interativo com **Leaflet + OpenStreetMap**: clique para informar coordenadas aproximadas. Não precisa de chave Google Maps. Requer internet para carregar os arquivos de mapa.
- Armazenamento no arquivo **`data/ocorrencias.json`**, gerado automaticamente ao iniciar o servidor. Dados permanecem após reiniciar o processo.
- Consulta, exportação JSON e exclusão por protocolo ou de toda a lista.
- Migração automática de dados antigos do `localStorage`: no primeiro acesso **pelo mesmo navegador e origem em que os dados foram salvos**, envia o histórico ao servidor e conserva a cópia original como backup. Se mudar de origem/porta, exporte o JSON antigo ou execute a versão anterior para recuperá-lo. A migração não remove denúncias históricas de outras cidades.

## API local

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/api/ocorrencias` | Lista ocorrências |
| POST | `/api/ocorrencias` | Cadastra uma ocorrência |
| POST | `/api/importar` | Migra até 100 registros antigos por lote, evitando protocolos duplicados |
| DELETE | `/api/ocorrencias/:id` | Exclui uma ocorrência |
| DELETE | `/api/ocorrencias` | Exclui todas |

O arquivo JSON **não é publicado pelo servidor web** e está no `.gitignore` para evitar envio acidental ao GitHub. Os registros são gravados no computador onde o processo Node roda, **não no GitHub nem no computador de cada visitante**.

## Limitações importantes

Este é um **protótipo escolar para uso local e confiável**, sem autenticação, controle de acesso, criptografia de dados em repouso ou verificação geográfica real. **Não disponibilize este servidor na internet** e não insira informações pessoais sensíveis. O mapa aceita coordenadas dentro de uma caixa aproximada ao redor de Joinville, não valida os limites municipais nem se o endereço corresponde ao ponto marcado. O envio do formulário **não encaminha denúncias aos órgãos ambientais**. Para denúncias oficiais, consulte o Ibama e os órgãos ambientais competentes.

Dados antigos existentes apenas no navegador não podem ser acessados automaticamente a partir de outro navegador, dispositivo ou origem.

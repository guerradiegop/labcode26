# Floresta em Pé — Joinville/SC

Site educativo de denúncias ambientais, projetado para **Chromebook e Chrome**, sem Node.js, instalação de bibliotecas, servidor ou internet.

## Como executar

1. Baixe os arquivos do projeto e mantenha `index.html`, `style.css`, `script.js` e `logo.png` na mesma pasta.
2. Abra `index.html` no Chrome (pode ser pelo app Arquivos do Chromebook).
3. Acesse **Denunciar** para registrar uma ocorrência.

## Dados: como não perder as ocorrências

- Os novos registros ficam automaticamente no **localStorage** do Chrome, sob a chave `floresta-ocorrencias`. Isso mantém os dados após fechar a página, mas **não sincroniza navegadores/dispositivos** e **não equivale a um backup em arquivo**.
- Na aba **Ocorrências**, clique **Salvar JSON** para escolher onde criar `ocorrencias.json` (se o Chrome permitir `showSaveFilePicker`). Se essa funcionalidade não estiver disponível, o navegador baixa o JSON: mova-o para a pasta do projeto no app Arquivos.
- Use **Salvar JSON** novamente depois das alterações para atualizar o arquivo escolhido enquanto a página estiver aberta; após reabrir a página, pode ser necessário escolher o arquivo de novo.
- Use **Baixar cópia JSON** como backup independente.
- Use **Importar JSON antigo** para adicionar os registros de um arquivo anterior sem duplicar protocolos. Registros históricos de outras cidades são preservados, mas **novos cadastros** só permitem Joinville/SC.
- Se mudar o local do HTML, a origem do site ou o navegador, o `localStorage` pode não acompanhar. **Faça backup antes**.
- O site não lê nem altera automaticamente o arquivo JSON sem a escolha/permissão do usuário; isso é uma restrição de segurança do navegador.
- Não use modo anônimo nem limpe os dados do site se quiser manter os registros.

## Formulário e mapa

- Município e estado fixos: **Joinville / SC**.
- Endereço obrigatório, ponto de referência opcional.
- O mapa é uma **ilustração esquemática offline**, feita com CSS, sem OpenStreetMap/Leaflet/Google Maps.
- Ao clicar nele, gera coordenadas **ilustrativas**; elas **não correspondem a uma localização geográfica real ou ao endereço digitado**. Não as utilize para fiscalização ou navegação.
- O formulário não encaminha ocorrências a órgãos ambientais.

## Limitações e privacidade

Este projeto é um protótipo escolar, **não um sistema oficial de denúncias**. Dados podem ser perdidos se o armazenamento do navegador for limpo. Quem tiver acesso ao perfil local do Chrome poderá consultar os registros. Evite registrar informações pessoais sensíveis.

A URL `tile.openstreetmap.org` foi removida porque o serviço impõe regras de identificação e pode bloquear requisições, em especial de páginas abertas localmente. O site não faz mais requisições a servidores de mapas.

# Instalador do AutoGrids

App Electron com uma tela simples: detecta o Illustrator, copia `com.autogrids.panel` para a pasta de extensões do CEP e habilita o modo de desenvolvimento do CEP automaticamente — os mesmos passos manuais do README principal, só que num clique.

## Status: construído aqui, ainda não testado num Mac/Windows real

Este ambiente de desenvolvimento é Linux, sem Illustrator e sem servidor de display — não dá para abrir a janela do instalador nem gerar o `.dmg`/instalador do Windows aqui. O que foi validado:

- `npm install` resolve corretamente (Electron 44.7.0 + electron-builder 26.15.3).
- Sintaxe de todos os arquivos.
- A lógica "pura" (detecção do Illustrator, cálculo dos caminhos de destino, montagem dos comandos que habilitam o modo de depuração) tem testes próprios em `test/`, com comandos reais do sistema (`defaults`/`reg`) e o sistema de arquivos substituídos por versões falsas — então eles verificam a lógica sem precisar de um Mac/Windows de verdade. Rode `npm test` para conferir.

O que **não** foi testado e só um Mac/Windows reais confirmam: se o Electron abre a janela normalmente, se os caminhos de detecção (`/Applications`, `%ProgramFiles%\Adobe`) batem com uma instalação real do Illustrator, se `defaults`/`reg.exe` têm permissão para escrever sem elevar privilégios, e se o `.dmg`/instalador `.exe` gerado pelo `electron-builder` realmente abre nessas máquinas.

**Sem assinatura digital:** por decisão explícita (custaria uma conta de desenvolvedor Apple + certificado de assinatura Windows), o instalador não é assinado. Isso significa que o Gatekeeper do Mac e o SmartScreen do Windows vão mostrar avisos de "aplicativo não identificado" — veja "Avisos de segurança esperados" mais abaixo.

## Testar a lógica (sem abrir a janela)

```bash
cd installer
npm install
npm test
```

## Rodar em modo de desenvolvimento (precisa de Mac ou Windows com interface gráfica)

```bash
cd installer
npm install
npm start
```

## Gerar o instalador final

```bash
cd installer
npm install
npm run dist
```

Gera o `.dmg` (Mac) ou o instalador `.exe` (Windows, NSIS) em `installer/dist/`. **Rode este comando na própria plataforma de destino** — o `electron-builder` empacota Mac no Mac e Windows no Windows (ou numa CI configurada para isso); não foi testado aqui se cross-compilar de Linux funciona para este projeto.

## Avisos de segurança esperados (sem assinatura)

- **macOS:** ao abrir o `.dmg`/app pela primeira vez, o Gatekeeper bloqueia com "não é possível abrir porque é de um desenvolvedor não identificado". Solução: clique com o botão direito no app → **Abrir** → confirmar no diálogo (só precisa fazer isso uma vez).
- **Windows:** o SmartScreen mostra "O Windows protegeu seu PC". Solução: clique em **Mais informações** → **Executar assim mesmo**.

## O que o instalador faz, exatamente

1. Procura pastas com "Adobe Illustrator" no nome em `/Applications` (Mac) ou `Adobe` dentro de `Program Files`/`Program Files (x86)` (Windows) — só para mostrar o que encontrou, não bloqueia a instalação se não achar nada.
2. Copia a pasta `com.autogrids.panel` (a mesma da raiz do repositório, empacotada dentro do instalador) para:
   - Mac: `~/Library/Application Support/Adobe/CEP/extensions/`
   - Windows: `%APPDATA%\Adobe\CEP\extensions\`
3. Habilita `PlayerDebugMode` para `CSXS.7` até `CSXS.12` (via `defaults write` no Mac, `reg add` no Windows) — o mesmo intervalo de versões do passo manual no README principal.

Não instala o script standalone `AutoGrids.jsx` — ele já é "zero-config" por design (só `Arquivo > Scripts > Outro Script...`), então automatizar isso teria risco (teria que descobrir a pasta de Scripts certa, que varia por idioma do Illustrator) sem ganho real.

## Estrutura

```
installer/
├── package.json
├── src/
│   ├── main.js       (processo principal do Electron)
│   ├── preload.js    (ponte segura entre main e a janela)
│   ├── detect.js      (lógica pura: achar instalações do Illustrator)
│   ├── install.js      (lógica pura: copiar arquivos, habilitar modo de depuração)
│   └── renderer/       (a janela em si: HTML/CSS/JS comum)
└── test/                (testes de detect.js/install.js, sem precisar do Electron rodando)
```

# AutoGrids

Painel para o Adobe Illustrator que cria grades de referência na prancheta ativa — quadriculado, isométrico, pautado, hexagonal e pontilhado — ajustando ao vivo enquanto você arrasta os controles. Cada prancheta tem a sua própria grade.

Este repositório também traz o **[AutoPhysics](#autophysics--física-e-animação-experimental)** (experimental): objetos que caem, colidem e se empilham dentro da prancheta, com exportação da queda em GIF.

> **Versão 1.1.1 — em validação.** Esta versão é para testar o uso no dia a dia; a interface do painel e do instalador vai ser redesenhada em breve. Encontrou algo estranho? Abra uma [issue](https://github.com/warroma/adobe-illustrator-autogrids/issues).

![Três pranchetas com grades diferentes: quadriculado com gutter, pontilhado e colmeia hexagonal](docs/img/visao-geral.png)

<table>
  <tr>
    <td align="center"><img src="docs/img/painel-retangular.png" width="260" alt="Painel na aba Guias com grade retangular e gutter"><br><sub><b>Guias</b> — retangular com gutter</sub></td>
    <td align="center"><img src="docs/img/painel-hexagonal.png" width="260" alt="Painel na aba Guias com grade hexagonal"><br><sub><b>Guias</b> — hexagonal</sub></td>
    <td align="center"><img src="docs/img/painel-pontos.png" width="260" alt="Painel na aba Pontos com pontilhado quadrado"><br><sub><b>Pontos</b> — pontilhado</sub></td>
  </tr>
</table>

## O que ele faz

| Aba | Tipos | O que vira no documento |
|---|---|---|
| **Guias** | Retangular, Isométrica, Linhas (pautado), Hexagonal | Guias do Illustrator — **não imprimem nem exportam** |
| **Pontos** | Quadrado, Triangular | Círculos de verdade — **imprimem e exportam** |

- **Tamanho da célula** e **margem** em mm, pol ou pt.
- **Gutter** (só guias): abre um vão entre as células — cada linha vira um par, e os triângulos/hexágonos ficam separados.
- **Tamanho do ponto** e **intensidade** (tom de cinza) para o pontilhado.
- **Uma grade por prancheta**: aplicar numa nunca mexe nas outras. O topo do painel mostra qual prancheta está ativa.

## Instalação

<p align="center">
  <a href="https://github.com/warroma/adobe-illustrator-autogrids/releases/latest/download/AutoGrids-Instalador-Windows.exe"><b>⬇ Baixar para Windows</b></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/warroma/adobe-illustrator-autogrids/releases/latest/download/AutoGrids-Instalador-macOS.dmg"><b>⬇ Baixar para macOS</b></a>
  <br><sub>todas as versões em <a href="https://github.com/warroma/adobe-illustrator-autogrids/releases">Releases</a></sub>
</p>

1. **Baixe** o instalador do seu sistema (links acima).
2. **Abra o arquivo.** Como ele não é assinado digitalmente, o sistema avisa na primeira vez:
   - **Windows** — "O Windows protegeu seu PC": clique em **Mais informações** e depois em **Executar assim mesmo**.
   - **macOS** — "desenvolvedor não identificado": clique com o botão direito no app, **Abrir**, e confirme em **Abrir**.

   Esse aviso aparece para qualquer programa sem assinatura digital — [entenda por que e o que o instalador faz](#perguntas-frequentes).
3. Clique em **Instalar painel**.
4. **Feche o Illustrator por completo e abra de novo** — ele só carrega o painel ao abrir.
5. Abra o painel em **Janela > Extensões > AutoGrids** e, se quiser, arraste a aba dele para a doca lateral.

**Para atualizar**, é igual: baixe o instalador da versão nova e clique em **Atualizar painel** — ele reconhece a versão instalada e troca sozinho. Seus documentos e grades não são afetados (os da 1.0.0 são convertidos para o formato novo na primeira vez que o painel os abre).

> O instalador do **Mac ainda não foi testado num Mac de verdade**. Se algo der errado, use a instalação manual abaixo e conte pra gente numa [issue](https://github.com/warroma/adobe-illustrator-autogrids/issues).

<details>
<summary><b>Instalação manual (sem o instalador)</b></summary>

1. Baixe o **Source code (zip)** da [última release](https://github.com/warroma/adobe-illustrator-autogrids/releases/latest) e descompacte.
2. Copie a pasta `com.autogrids.panel` inteira para:
   - **Windows:** `%APPDATA%\Adobe\CEP\extensions\` (cole esse caminho na barra do Explorador de Arquivos)
   - **macOS:** `~/Library/Application Support/Adobe/CEP/extensions/` (no Finder, `Cmd+Shift+G` e cole o caminho — a pasta `Library` fica oculta)

   Se as pastas `CEP` ou `extensions` não existirem, crie-as. Ao atualizar, apague a pasta antiga antes de copiar a nova.
3. Libere extensões de desenvolvimento (uma vez só):
   - **Windows** — no PowerShell:
     ```powershell
     '7','8','9','10','11','12' | ForEach-Object {
         $p = "HKCU:\Software\Adobe\CSXS.$_"
         if (-not (Test-Path $p)) { New-Item -Path $p -Force | Out-Null }
         New-ItemProperty -Path $p -Name PlayerDebugMode -Value "1" -PropertyType String -Force | Out-Null
     }
     ```
   - **macOS** — no Terminal (o `xattr` tira a "quarentena" que o macOS põe em arquivos baixados e que faz o painel abrir em branco):
     ```bash
     for v in 9 10 11 12; do defaults write com.adobe.CSXS.$v PlayerDebugMode 1; done
     xattr -cr ~/Library/Application\ Support/Adobe/CEP/extensions/com.autogrids.panel
     ```
4. Feche o Illustrator por completo, abra de novo e vá em **Janela > Extensões > AutoGrids**.
</details>

<details>
<summary><b>Script avulso (sem instalar nada)</b></summary>

Abra o [`AutoGrids.jsx`](AutoGrids.jsx) em **Arquivo > Scripts > Outro Script...**. É uma janela simples, sem doca, só com grade retangular e isométrica.
</details>

## Como usar

1. **Abra um documento e clique na prancheta** onde quer a grade.
2. **Confira o nome no topo do painel** ("Prancheta ativa"). É lá que a grade vai cair — a borda de seleção do Illustrator e o nome no painel precisam bater.
3. **Escolha a aba e o tipo** (Guias ou Pontos). A grade aparece na hora.
4. **Ajuste os controles** — a grade acompanha enquanto você arrasta. Dá para digitar o valor exato na caixa ao lado de cada controle.
5. **Para trocar de prancheta**, clique em outra: o painel carrega os controles com a grade que já existe nela (sem redesenhar nada). Numa prancheta sem grade, os controles ficam como estavam, prontos para criar uma.
6. **Limpar prancheta** remove a grade só da prancheta ativa.

### Uso correto — faça e evite

| ✅ Faça | ⛔ Evite |
|---|---|
| Use **Limpar prancheta** para tirar uma grade. | Destravar a camada **AutoGrids** e apagar ou mover objetos lá dentro na mão — o painel perde a referência daquela grade. |
| Para esconder as guias temporariamente: **Exibir > Guias > Ocultar guias** (`Ctrl+;` / `Cmd+;`). | Esquecer o **pontilhado** visível ao exportar: pontos imprimem. Oculte a camada AutoGrids (ou só o grupo daquela prancheta) antes de entregar o arquivo. |
| Renomear, reordenar e mover pranchetas à vontade — a grade acompanha (mova levando a arte junto, que é o padrão). | Excluir uma prancheta que ainda tem grade: a grade fica solta no documento, como qualquer arte. **Limpe antes de excluir.** |
| Usar células maiores em pranchetas grandes. Grades muito densas aplicam só ao soltar o controle, e as densas demais são recusadas com uma mensagem (a grade anterior fica intacta). | Esperar que o painel recarregue sozinho depois de instalar ou atualizar — **feche e reabra o Illustrator**. |

### Onde a grade fica no documento

Tudo fica numa camada só, **AutoGrids**, travada entre uma aplicação e outra, com **um grupo por prancheta** que leva o nome da prancheta. A ligação entre a grade e a prancheta é pela **posição** (a grade pertence à prancheta sobre a qual está), não pelo nome nem pelo número — que mudam quando você renomeia, reordena ou exclui pranchetas. Se uma prancheta for movida *sem* a arte, o painel ainda a reconhece pelo nome. O nome do grupo se atualiza sozinho quando você troca de prancheta ou aplica uma grade.

Guias e pontos são exclusivos por prancheta: aplicar uma grade de guias remove o pontilhado daquela prancheta e vice-versa. Ao sair da aba Pontos, o pontilhado da prancheta ativa é removido para não ficar esquecido por baixo das guias.

### Desempenho em computadores mais fracos

O peso não está no cálculo (aritmética simples), e sim em quantos objetos o Illustrator precisa criar — trabalho de processador, na thread principal do Illustrator; a placa de vídeo só desenha o resultado, como qualquer outra arte. Por isso o painel estima o tamanho da grade **antes** de mexer no documento:

- **Grades leves** (praticamente todas as de guias) acompanham o controle ao vivo. Nunca há mais de uma atualização na fila: num computador lento a grade só atualiza menos vezes por segundo, sem acumular atraso.
- **Grades pesadas** (ex.: pontos de 5 mm numa A4, ~2.600 círculos) aplicam uma vez só, ao soltar o controle — o painel avisa.
- **Grades densas demais** (ex.: pontos de 3 mm numa A4, ~7.000 círculos) não são aplicadas: aparece uma mensagem pedindo uma célula maior.

## Perguntas frequentes

<details>
<summary><b>Apareceu um aviso dizendo que o instalador pode ser perigoso. É seguro?</b></summary>

O Windows e o macOS mostram esse aviso para **qualquer** programa que não tem **assinatura digital** — um certificado pago que identifica quem publicou o programa. O AutoGrids é um projeto gratuito e de código aberto, e por isso não tem essa assinatura. O aviso não significa que algo errado foi encontrado nele.

O instalador faz só o que está descrito na próxima pergunta: não acessa a internet, não coleta dados, não instala mais nada e não precisa de permissão de administrador. O painel em si é um conjunto de scripts (HTML e JavaScript) que roda dentro do Illustrator, e todo o código está neste repositório para quem quiser conferir.
</details>

<details>
<summary><b>O que exatamente o instalador muda no meu computador?</b></summary>

1. Copia a pasta do painel (`com.autogrids.panel`) para a pasta onde o Illustrator procura painéis extras: `%APPDATA%\Adobe\CEP\extensions` no Windows, `~/Library/Application Support/Adobe/CEP/extensions` no Mac.
2. Liga o "modo de desenvolvimento" do Illustrator (explicado abaixo) — uma configuração que vale só para o seu usuário. No Windows, é o valor `PlayerDebugMode` nas chaves `HKEY_CURRENT_USER\Software\Adobe\CSXS.7` a `CSXS.12`.
3. No Mac, tira da pasta copiada a marca de "baixado da internet", que impediria o painel de abrir.

Nada além disso.
</details>

<details>
<summary><b>O que é CEP e esse "modo de desenvolvimento"?</b></summary>

CEP é o sistema que a Adobe usa para os painéis extras do Illustrator — o painel Bibliotecas, por exemplo, é feito com ele. Normalmente o Illustrator só carrega painéis com assinatura digital; o "modo de desenvolvimento" é uma chave do próprio Illustrator que permite carregar painéis sem assinatura, como o AutoGrids. Ela não muda nada no resto do Illustrator, mas vale para qualquer painel sem assinatura — então, como sempre, só instale painéis de quem você confia.
</details>

<details>
<summary><b>Como desinstalar?</b></summary>

Apague a pasta `com.autogrids.panel` de dentro da pasta de extensões citada acima e reinicie o Illustrator.
</details>

## Problemas conhecidos

- **Pontos que não aparecem na tela:** no Illustrator 2026, objetos criados por extensões CEP às vezes não são redesenhados na hora (as guias não têm esse problema). Os pontos estão lá — o grupo da prancheta na camada AutoGrids mostra a contagem. Redimensionar a janela do Illustrator força o redesenho.
- **Ícone genérico logo depois de atualizar:** quem tinha o painel encaixado na versão 1.0.0 (sem ícone) ainda vê o ícone genérico na primeira abertura depois de atualizar — o Illustrator guarda o ícone no espaço de trabalho e só grava o novo ao fechar. Feche e abra mais uma vez.

## AutoPhysics — física e animação (experimental)

Um segundo painel, independente do AutoGrids, que **deixa objetos caírem dentro da prancheta**: eles despencam com gravidade, batem uns nos outros e nas bordas da prancheta, quicam e se acomodam numa pilha. Você aplica o resultado no documento (um passo só de desfazer) e pode **exportar a queda como GIF animado** — uma animação feita a partir da arte do Illustrator.

Nada roda em tempo real: a simulação é calculada inteira quando você clica em **Simular**, e o documento só muda quando você clica em **Aplicar estado final**.

### Instalar

Ainda não está no instalador. Copie a pasta [`com.autophysics.panel`](com.autophysics.panel) para a mesma pasta de extensões do AutoGrids (veja **Instalação manual** acima — o passo do "modo de desenvolvimento" vale para os dois painéis e não precisa ser repetido), reinicie o Illustrator e abra **Janela > Extensões > AutoPhysics**. Requer Illustrator 2020 (24.0) ou mais recente.

### Como usar

1. **Selecione os objetos que vão cair** e clique em **Capturar seleção**. Cada objeto selecionado vira um corpo; um grupo cai como um corpo só. A prancheta onde eles estão vira a "caixa" da simulação — os objetos podem começar acima dela, que caem para dentro.
2. **Ajuste cada objeto** — clique nele na lista (Ctrl/Cmd e Shift para vários; ele também é selecionado no Illustrator):
   - **Elasticidade**: quanto ele quica (0% = cai e para; 100% = quica para sempre).
   - **Peso**: densidade relativa. O mais pesado empurra o mais leve nas colisões e, com resistência do ar, cai mais rápido.
   - **Offset de colisão**: positivo deixa uma folga em volta do objeto; negativo deixa os objetos se sobreporem.
3. **Ajuste o mundo** (vale para todos): gravidade (100% = Terra), resistência do ar, atrito, duração máxima e quais bordas da prancheta são paredes (chão, laterais, teto).
4. **Simular** — a prévia mostra as formas de colisão caindo. Ajuste e simule de novo quantas vezes quiser; o documento não é tocado.
5. **Aplicar estado final** move os objetos para onde a simulação terminou. `Ctrl+Z` / `Cmd+Z` volta tudo ao início.
6. **Exportar GIF…** — largura, quadros por segundo, velocidade (câmera lenta), tempo parado no fim, fundo (a arte da prancheta ou branco) e repetição. Funciona antes ou depois de aplicar o estado final.

Os ajustes de cada objeto ficam gravados nele (numa *tag* invisível do Illustrator) ao aplicar, e voltam numa próxima captura.

### Como a física funciona

- O motor (`js/physics.js`) segue o **Box2D** de Erin Catto: colisão entre polígonos convexos e círculos (SAT + recorte de arestas), impulsos sequenciais com *warm starting* e correção de penetração separada da velocidade — é o que deixa uma pilha parada em vez de tremendo. Roda no próprio painel, em passos de 1/200 s; 150 objetos levam menos de 1 segundo.
- **Restituição** (elasticidade): na batida, a velocidade de volta é a de chegada × elasticidade, então a altura do quique é elasticidade² da queda. Entre dois objetos vale a maior das duas (uma bola elástica quica até num chão "morto").
- **Massa e gravidade**: no vácuo, objetos pesados e leves caem juntos (Galileu) — a massa só muda as colisões. Por isso existe a **resistência do ar**: um arrasto proporcional ao tamanho e à velocidade faz cada objeto ter a sua velocidade terminal, `g × massa / arrasto`. Com ar, o mais pesado cai mais rápido.
- **Escala**: a prancheta vale ~2 m (raiz de largura × altura). Com 100% de gravidade, um objeto cai a altura de uma A4 em ~0,6 s, como cairia de 2 m de verdade.
- **Aplicar no documento**: o Illustrator só gira objetos em torno de pontos fixos (centro dos limites, cantos, origem). O painel gira cada objeto em torno da origem do documento, mede onde o centro de massa foi parar com um caminho-sonda temporário e translada a diferença.
- **GIF**: o Illustrator exporta um PNG transparente de cada objeto (com a aparência exata: gradientes, efeitos, texto) e outro do fundo. Os quadros são montados no painel, girando e movendo esses PNGs, e codificados num GIF com paleta global de 255 cores e quadros incrementais (só o que mudou de um quadro para o outro).

### Limitações

- A colisão usa a **"casca" convexa** de cada objeto (como um elástico esticado em volta dele). Estrelas, letras e outras formas côncavas colidem pela casca. Círculos são reconhecidos e rolam de verdade.
- **Texto vivo** colide pela caixa do texto; para colisão pelas letras, converta em contornos.
- No GIF, a ordem de empilhamento dos objetos segue a da seleção, e a arte que **não** foi simulada fica sempre atrás deles.
- GIF tem no máximo 256 cores: degradês muito suaves podem ganhar faixas.

## Requisitos

- Adobe Illustrator 2023 ou mais recente (desenvolvido e testado no Illustrator 2026, Windows) — o AutoPhysics funciona a partir do Illustrator 2020
- Windows ou macOS

## Desenvolvimento

```
com.autogrids.panel/   o painel (CEP): index.html, css/, js/main.js, jsx/host.jsx (motor ExtendScript), icons/
com.autophysics.panel/ painel AutoPhysics: js/physics.js (motor), js/gif.js (encoder), js/bridge.js, js/main.js, jsx/host.jsx
installer/             instalador Electron (lógica testável em src/detect.js e src/install.js; `npm test`)
test/autophysics/      testes do AutoPhysics em Node, sem dependências (ver abaixo)
AutoGrids.jsx          versão script avulso, sem painel
docs/img/              imagens deste README
```

- **Testes do AutoPhysics** (Node 18+, nada para instalar):
  ```bash
  node test/autophysics/physics.test.js   # pilha estável, quique = elasticidade², peso x ar, offset
  node test/autophysics/gif.test.js       # GIF codificado e decodificado de volta, pixel a pixel
  node test/autophysics/bridge.test.js    # host.jsx real contra um Illustrator falso: captura -> física -> aplicar
  ```

- Para trabalhar no próprio clone sem reinstalar a cada mudança, troque a pasta instalada por um atalho para o repositório — cada mudança passa a valer ao reabrir o Illustrator. No Windows:
  ```powershell
  New-Item -ItemType Junction -Path "$env:APPDATA\Adobe\CEP\extensions\com.autogrids.panel" -Target "<clone>\com.autogrids.panel"
  ```
  Rodar o instalador troca esse atalho por uma cópia da versão dele (o clone não é alterado); para voltar a trabalhar direto no clone, crie o atalho de novo.
- O `host.jsx` pode ser testado fora do painel, pela ponte COM do Illustrator no Windows (`New-Object -ComObject Illustrator.Application` → `DoJavaScript('$.evalFile(...)')`), chamando `AutoGrids_apply` e companhia direto.
- A versão do painel fica em `ExtensionBundleVersion` no [`CSXS/manifest.xml`](com.autogrids.panel/CSXS/manifest.xml) — é ela que o instalador compara para decidir entre instalar, atualizar ou reinstalar.
- **Publicar uma versão:** suba a versão no manifest e no `installer/package.json`, escreva as notas em `docs/release-notes/vX.Y.Z.md` e empurre a tag (`git tag vX.Y.Z` e `git push origin vX.Y.Z`). O workflow [`release.yml`](.github/workflows/release.yml) monta o `.exe` (Windows) e o `.dmg` (macOS), roda os testes e publica a release com esses arquivos — os links de download do README apontam sempre para a última.

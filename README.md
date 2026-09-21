# AutoGrids

Painel para o Adobe Illustrator que gera grades de referência direto na prancheta ativa, com pré-visualização em tempo real: retangular, isométrica, linhas (pautado), hexagonal, pontos quadrados e pontos triangulares. Cada prancheta guarda sua própria grade de forma independente — aplicar numa não mexe nas outras, mesmo trocando de prancheta no meio do ajuste.

Tem também uma aba **Líquido**, que conecta duas formas selecionadas com uma ponte orgânica (efeito "metaball"/gooey, tipo gotas de líquido se atraindo), controlada por um slider de força ("Pregnância").

Duas formas de usar: um **painel ancorável** (recomendado) ou um **script simples** sem instalação de extensão (mais limitado, só retangular/isométrica).

## Instalação

### Opção 1 — Painel ancorável (recomendado)

O painel usa a tecnologia CEP da Adobe. Como não é assinado digitalmente, o Illustrator precisa ser configurado uma única vez para aceitar extensões de desenvolvimento.

**1. Copie a pasta da extensão**

Copie a pasta [`com.autogrids.panel`](com.autogrids.panel) inteira para a pasta de extensões do CEP:

- **Windows:** `%APPDATA%\Adobe\CEP\extensions\`
- **macOS:** `~/Library/Application Support/Adobe/CEP/extensions/`

Se as pastas `CEP` ou `extensions` ainda não existirem no seu Mac, pode criá-las normalmente — são só pastas comuns, o Illustrator não precisa que elas já existam antes.

> **No Mac, duas pegadinhas específicas dessa etapa:**
>
> - **A pasta `Library` fica oculta no Finder.** Duas formas de chegar nela: no Finder, pressione `Cmd+Shift+G` e cole o caminho `~/Library/Application Support/Adobe/CEP/extensions/`; ou, com o Finder em foco, segure `Option` e clique no menu **Ir** — "Library" aparece na lista.
> - **Se você baixou o repositório como `.zip` pelo navegador** (em vez de `git clone`), rode isto no Terminal *depois* de colocar a pasta no destino final, antes de abrir o Illustrator. O macOS marca arquivos baixados da internet com um atributo de "quarentena" que pode fazer a extensão não aparecer no menu ou o painel abrir em branco:
>   ```bash
>   xattr -cr ~/Library/Application\ Support/Adobe/CEP/extensions/com.autogrids.panel
>   ```

**2. Habilite o modo de desenvolvimento do CEP** (uma vez só)

No Windows, abra o PowerShell e cole:

```powershell
'7','8','9','10','11','12' | ForEach-Object {
    $p = "HKCU:\Software\Adobe\CSXS.$_"
    if (-not (Test-Path $p)) { New-Item -Path $p -Force | Out-Null }
    New-ItemProperty -Path $p -Name PlayerDebugMode -Value "1" -PropertyType String -Force | Out-Null
}
```

No macOS, abra o Terminal e cole (repita trocando o número da versão se precisar):

```bash
defaults write com.adobe.CSXS.9 PlayerDebugMode 1
defaults write com.adobe.CSXS.10 PlayerDebugMode 1
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
defaults write com.adobe.CSXS.12 PlayerDebugMode 1
```

**3. Reinicie o Illustrator** (feche completamente e abra de novo — não basta fechar e reabrir só o painel)

**4. Abra o painel**

No Illustrator: **Janela > Extensões > AutoGrids**. Arraste a aba do painel para a doca lateral (perto de Camadas, por exemplo) se quiser deixá-lo fixo ali.

### Opção 2 — Script simples (sem instalação de extensão)

Se preferir não mexer em configurações do sistema:

1. Baixe o arquivo [`AutoGrids.jsx`](AutoGrids.jsx)
2. No Illustrator: **Arquivo > Scripts > Outro Script...** e selecione o arquivo
   - Ou copie o arquivo para a pasta de scripts do Illustrator (`Presets/<idioma>/Scripts`) para ele aparecer direto no menu **Arquivo > Scripts**
3. Essa versão abre como uma janela flutuante (não ancora na doca) e só tem grade retangular e isométrica

## Como usar

1. Com um documento aberto no Illustrator, deixe ativa a prancheta onde quer a grade e abra o painel AutoGrids
2. Escolha a aba **Guias** (retangular, isométrica, linhas, hexagonal), **Pontos** (quadrado, triangular) ou **Líquido** (ponte entre 2 formas) e o tipo desejado — nas abas Guias/Pontos a prévia atualiza em tempo real na prancheta ativa a cada mudança, sem precisar clicar em nenhum botão
3. Ajuste o tamanho da célula e a margem pelos controles deslizantes; troque a unidade (mm/pol/pt) como preferir; na aba Pontos, ajuste também o tamanho do ponto e a intensidade (tom de cinza)
4. **Limpar prancheta** remove a grade só da prancheta que está ativa no momento

Cada prancheta guarda sua própria grade de forma independente: aplicar/ajustar numa prancheta nunca mexe nas grades já aplicadas nas outras, mesmo trocando de prancheta no meio do ajuste.

### Por que Guias e Pontos funcionam diferente

- **Guias** (retangular, isométrica, linhas, hexagonal) viram guias de verdade do Illustrator: não imprimem, não exportam, ficam numa camada travada chamada "AutoGrids Guides".
- **Pontos** (quadrado, triangular) viram objetos reais (círculos preenchidos) numa camada chamada "AutoGrids Pontos" — uma guia não tem preenchimento, então um ponto marcado como guia ficaria praticamente invisível (só um contorno fino). Por isso eles **imprimem e exportam normalmente**: remova ou oculte essa camada antes de entregar o arquivo final. Ao trocar de volta para a aba Guias, os pontos da prancheta ativa são removidos automaticamente, para não ficarem esquecidos sobrepostos às guias.

### Como funciona a aba Líquido

Conecta duas formas com uma ponte orgânica, como se fossem gotas de líquido se atraindo — o efeito às vezes chamado de "metaball" ou "gooey". Diferente de Guias/Pontos, não trabalha em cima da prancheta: trabalha em cima da **seleção atual**.

1. Desenhe/posicione as 2 formas (círculo, elipse ou retângulo — de preferência bem arredondado, veja limitações abaixo), selecione as duas e clique em **Capturar seleção**
2. Ajuste o slider **Pregnância**: quanto maior, mais "esticada"/cheia fica a ponte entre as formas, e mais longe uma da outra elas ainda conseguem se conectar; em 0% a ponte praticamente some
3. A ponte vira um objeto real, sem contorno, numa camada chamada "AutoGrids Líquido" (enviada pra trás das demais camadas) — as 2 formas originais continuam intactas e editáveis por cima dela
4. Pra conectar outro par, é só selecionar e clicar em **Capturar seleção** de novo — a ponte anterior não é apagada, então dá pra ir encadeando várias conexões (A↔B, B↔C, ...) pra simular um cluster de formas se atraindo
5. **Limpar conexões líquidas** remove todas as pontes já geradas (documento inteiro, não só a prancheta ativa)

Limitações da v1:
- Funciona com **1 par de formas por vez** (não com um grupo de 3+ formas simultâneas)
- Só reconhece formas "simples" (`PathItem`: retângulo, elipse etc.) — grupos, texto e compound paths ainda não são suportados
- A ponte usa a posição e a cor de preenchimento capturadas no momento do clique em "Capturar seleção". Se mover as formas depois, capture de novo
- A curva é calculada em cima da elipse inscrita no retângulo delimitador de cada forma — funciona muito bem com círculos, elipses e retângulos bem arredondados (como no exemplo que inspirou essa aba); retângulos de cantos vivos ou pouco arredondados podem ficar com uma pequena folga entre a ponte e o canto real da forma

## Limitação conhecida

Nesta versão do Illustrator (2026), os objetos criados na aba Pontos às vezes não aparecem imediatamente na tela — um bug de atualização de tela do próprio Illustrator ao criar arte por extensões CEP (as guias não têm esse problema). Os pontos são criados corretamente mesmo assim (confira no painel de Camadas: a camada "AutoGrids Pontos" mostra a quantidade de objetos). Se não aparecerem, redimensionar a janela do Illustrator (arrastar uma borda) costuma forçar a atualização da tela.

## Requisitos

- Adobe Illustrator 2023 ou mais recente (desenvolvido e testado no Illustrator 2026, Windows)
- Windows ou macOS

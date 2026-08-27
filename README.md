# AutoGrids

Script para Adobe Illustrator que gera **guias de grade** (retangular e isométrica, por enquanto) automaticamente dentro dos limites da prancheta ativa, com um painel para ajustar colunas/linhas, tamanho da célula e margem — e regenerar quantas vezes quiser.

## Por que um script ExtendScript, e não um "plugin" no sentido moderno?

Pesquisei a documentação e o estado atual da extensibilidade do Illustrator (2026) antes de começar:

- **UXP**, a plataforma moderna de plugins da Adobe (a que já roda no Photoshop, InDesign e XD), **ainda não está aberta para desenvolvedores terceiros no Illustrator** — está restrita a um programa interno/NDA da Adobe. Não é algo que dê pra instalar com uma conta Creative Cloud normal.
- **CEP** (a plataforma anterior, baseada em HTML/CSS/JS + Node) ainda funciona no Illustrator atual, mas está descontinuada pela Adobe e exige bem mais infraestrutura (Node.js, certificados de assinatura, empacotamento em `.zxp`) para um ganho de UI que não é essencial neste projeto.
- O **SDK nativo em C++** serve para plugins profundos (ferramentas novas, efeitos ao vivo, formatos de arquivo customizados) — build por plataforma, assinatura de plugin, ciclo de compilação. Não se aplica aqui.
- **ExtendScript (`.jsx`)** é a via oficialmente suportada e madura para automação no Illustrator: acesso completo ao modelo de objetos (documentos, pranchetas, guias, camadas), interface própria via `ScriptUI`, e **não exige SDK, build nem conta de desenvolvedor** — só o Illustrator (que você já tem) e um editor de texto.

Ou seja: sua intuição de que "seria uma série de scripts" estava certa, e é a via correta — não um workaround.

## Requisitos

- Adobe Illustrator (qualquer versão recente o suficiente para suportar `ScriptUI`, o que cobre praticamente tudo desde CS).
- Nada além disso. Opcional: [VS Code](https://code.visualstudio.com/) com a extensão gratuita **ExtendScript Debugger** da Adobe, só para ter autocomplete e depuração melhores — não é obrigatório.

## Instalação

**Opção rápida (sem copiar nada):** no Illustrator, `Arquivo > Scripts > Outro Script...` e selecione `scripts/AutoGrids.jsx`.

**Opção fixa (aparece direto no menu Scripts):** copie `scripts/AutoGrids.jsx` para a pasta de Scripts do Illustrator e reinicie o app (essa pasta só é lida na abertura):

- macOS: `/Applications/Adobe Illustrator [versão]/Presets/[idioma]/Scripts/`
- Windows: `C:\Program Files\Adobe\Adobe Illustrator [versão]\Presets\[idioma]\Scripts\`

## Como usar

1. Abra um documento e deixe a prancheta desejada como ativa (a grade sempre usa a prancheta ativa no momento de clicar em Aplicar).
2. Rode o script.
3. Escolha o tipo de grade, ajuste os parâmetros e clique em **Aplicar**.
4. Mude os valores e clique em **Aplicar** de novo à vontade — a grade anterior é substituída automaticamente, então é assim que você "redimensiona" a grade. **Limpar grade** remove tudo. **Fechar** fecha o painel.

As guias ficam numa camada dedicada chamada `AutoGrids Guides`, travada para não atrapalhar sua arte.

## Tipos de grade (v1)

- **Retangular**: número de colunas e linhas dentro da área útil da prancheta (prancheta menos a margem).
- **Isométrica**: três famílias de guias — verticais, +30° e −30° — com o mesmo espaçamento perpendicular entre si, formando losangos isométricos consistentes. O parâmetro "tamanho da célula" é esse espaçamento.

## Limitações conhecidas / próximos passos

- Os campos numéricos estão em **pontos (pt)**, o valor interno do Illustrator — ainda não converte automaticamente para mm/px/in seguindo a régua do documento.
- A matemática da grade (incluindo o recorte das diagonais isométricas contra os limites da prancheta) foi validada com testes numéricos isolados fora do Illustrator, mas o script **ainda não foi testado dentro do Illustrator de verdade** — este ambiente de desenvolvimento não tem o Illustrator instalado para rodar. Teste no seu Illustrator e me avise se algo não funcionar como esperado (a mensagem de erro exata, se aparecer, ajuda a corrigir rápido).
- Roadmap possível, em ordem de prioridade sugerida: gutter separado de margem, grade triangular/hexagonal, grade de linha de base (baseline), conversão de unidades pela régua do documento, lembrar os últimos valores usados entre execuções, e — se um dia a Adobe abrir UXP para Illustrator — migrar para um painel dockado mais bonito no lugar do `ScriptUI`.

## Referências

- [Adobe Illustrator Scripting Guide (docsforadobe)](https://ai-scripting.docsforadobe.dev/)
- [UXP for Illustrator: Status & What to Use Today (Mapsoft)](https://mapsoft.com/posts/illustrator-uxp-status.html)
- [Install and run scripts in Illustrator (Adobe)](https://helpx.adobe.com/illustrator/using/automation-scripts.html)

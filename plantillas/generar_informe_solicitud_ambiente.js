const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, AlignmentType, Header, Footer, PageNumber, LevelFormat,
        PageBreak, BorderStyle, Table, TableRow, TableCell, WidthType, ShadingType, TabStopType } = require('docx');

const AZUL = '1F3864', CELESTE = '2E74B5', GRIS = '7F7F7F';
const W = 9026; // ancho útil A4 con márgenes de 1440

function banner() {
  // franja de texto que reemplaza la imagen del encabezado original
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: [2600, 3826, 2600],
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: 2600, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: 'D9D9D9', color: 'auto' },
        margins: { top: 60, bottom: 60, left: 120, right: 80 },
        children: [new Paragraph({ children: [new TextRun({ text: 'división ', size: 16, color: GRIS }), new TextRun({ text: 'operaciones', size: 16, bold: true, color: AZUL })] }),
                   new Paragraph({ children: [new TextRun({ text: 'y tecnología', size: 16, bold: true, color: AZUL })] })] }),
      new TableCell({ width: { size: 3826, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: '1F4E79', color: 'auto' },
        verticalAlign: 'center', margins: { top: 60, bottom: 60, left: 120, right: 80 },
        children: [new Paragraph({ children: [new TextRun({ text: 'el banco en movimiento', size: 16, color: 'FFFFFF' })] })] }),
      new TableCell({ width: { size: 2600, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: '1F4E79', color: 'auto' },
        verticalAlign: 'center', margins: { top: 60, bottom: 60, left: 80, right: 120 },
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Banco de Chile', size: 18, bold: true, italics: true, color: 'FFFFFF', font: 'Times New Roman' })] })] }),
    ] })],
  });
}
const linea = (color) => new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 8, color, space: 1 } }, children: [] });
const titulo = (t, after = 0) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after },
  children: [new TextRun({ text: t, bold: true, size: 40, color: CELESTE })] });
const vacio = (n) => Array.from({ length: n }, () => new Paragraph({ children: [] }));

const doc = new Document({
  creator: 'Ciberseguridad', title: 'Informe de Solicitud de Ambiente',
  styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
  numbering: { config: [{ reference: 'secciones', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
  sections: [
    { // Portada
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      children: [
        banner(), linea(AZUL), ...vacio(14),
        titulo('Informe de Solicitud de'), titulo('Ambiente'),
        titulo('Proyecto ART XXXXXX   - Actividades y'), titulo('requerimientos de Ciberseguridad', 400),
        titulo('dd/mm/aaaa'),
      ],
    },
    { // Contenido
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      footers: { default: new Footer({ children: [
        new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 4, color: '000000', space: 4 } },
          tabStops: [{ type: TabStopType.CENTER, position: 4513 }, { type: TabStopType.RIGHT, position: W }],
          children: [new TextRun({ text: '\t', size: 14 }),
            new TextRun({ text: 'Página ', size: 14, color: CELESTE }), new TextRun({ children: [PageNumber.CURRENT], size: 14, color: CELESTE }),
            new TextRun({ text: ' de ', size: 14, color: CELESTE }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: CELESTE }),
            new TextRun({ text: '\tAdministración de Ambientes Pre-Productivos', size: 14, color: CELESTE })] }),
      ] }) },
      children: [
        banner(),
        new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 60 }, children: [new TextRun({ text: 'Gerencia Ambientes Tecnológicos', italics: true, size: 16, color: CELESTE })] }),
        linea(GRIS), ...vacio(4),
        new Paragraph({ numbering: { reference: 'secciones', level: 0 }, spacing: { after: 160 }, children: [new TextRun({ text: 'Requerimientos y solicitudes del proyecto', bold: true, color: AZUL })] }),
        new Paragraph({ indent: { left: 720 }, spacing: { after: 240 }, children: [new TextRun({ text: '<Descripción detallada del requerimiento>' })] }),
        new Paragraph({ numbering: { reference: 'secciones', level: 0 }, spacing: { after: 160 }, children: [new TextRun({ text: 'Información Solicitada o Análisis del Ambiente', bold: true, color: AZUL })] }),
        new Paragraph({ indent: { left: 720 }, children: [new TextRun({ text: '<No llenar, acá se entrega la respuesta al requerimiento>' })] }),
      ],
    },
  ],
});
Packer.toBuffer(doc).then(b => fs.writeFileSync(__dirname + '/Informe Solicitud de Ambiente.docx', b));

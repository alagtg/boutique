import { Injectable } from '@angular/core';
import JsBarcode from 'jsbarcode';

export interface ProductLabel {
  productName: string;
  barcode: string;
  price: number;
  color?: string;
  size?: string;
}

@Injectable({ providedIn: 'root' })
export class LabelPrinterService {
  open(): Window | null {
    return window.open('', '_blank', 'width=680,height=500');
  }

  print(target: Window, label: ProductLabel, size: string, copies: number) {
    const dimensions: Record<string, [number, number]> = { '50x30': [50, 30], '60x40': [60, 40], '80x40': [80, 40] };
    const [width, height] = dimensions[size] || dimensions['50x30'];
    if (!Number.isInteger(copies) || copies < 1 || copies > 100) throw new Error('Choisir de 1 a 100 etiquettes.');
    if (!/^[\x21-\x7e]{1,40}$/.test(label.barcode)) throw new Error('Code-barres absent ou non imprimable.');
    const svg = target.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, label.barcode, { format: 'CODE128', width: 1, height: 40,
      marginLeft: 10, marginRight: 10, marginTop: 0, marginBottom: 0, displayValue: false,
      background: '#ffffff', lineColor: '#000000' });
    const modules = parseFloat(svg.getAttribute('width') || '');
    if (!Number.isFinite(modules) || modules <= 0) throw new Error('Dimensions du code-barres invalides.');
    // A module is exactly 2 dots at 203 dpi. Never squeeze a long code to fit a smaller label.
    const barcodeWidthMm = modules * 25.4 * 2 / 203;
    if (barcodeWidthMm > width - 4) throw new Error('Code trop long pour ce format. Choisir une etiquette plus large.');
    svg.style.width = `${barcodeWidthMm}mm`;
    svg.style.height = '11mm';
    svg.style.display = 'block';
    svg.style.margin = '0 auto';
    target.document.open();
    target.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Etiquettes</title><style>
      @page{size:${width}mm ${height}mm;margin:0}*{box-sizing:border-box}body{margin:0;color:#000;background:#fff;font-family:Arial,sans-serif}
      .label{width:${width}mm;height:${height}mm;padding:1.5mm 2mm;overflow:hidden;break-after:page;text-align:center;display:flex;flex-direction:column;justify-content:center;gap:.4mm}
      .label:last-child{break-after:auto}.name{font-size:8pt;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .details{font-size:7pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.price{font-size:10pt;font-weight:bold}.code{font-family:monospace;font-size:8pt;letter-spacing:0}
      @media screen{body{padding:12px}.label{outline:1px solid #ddd;margin:0 auto 12px}}
    </style></head><body></body></html>`);
    const doc = target.document;
    for (let i = 0; i < copies; i++) {
      const item = doc.createElement('section'); item.className = 'label';
      const add = (className: string, text: string) => {
        const element = doc.createElement('div'); element.className = className; element.textContent = text; item.appendChild(element);
      };
      add('name', label.productName);
      add('details', [label.color, label.size].filter(Boolean).join(' / '));
      add('price', `${Number(label.price).toFixed(2)} DT`);
      item.appendChild(svg.cloneNode(true));
      add('code', label.barcode);
      doc.body.appendChild(item);
    }
    doc.close();
    target.setTimeout(() => { if (!target.closed) { target.focus(); target.print(); } }, 250);
  }
}

# DANFE PDF Generator — Implementation Guide

## Stack
- **Node.js + TypeScript + NestJS** (runtime)
- **PDFKit** (PDF generation with absolute coordinates)
- **bwip-js** (Code128 barcode)
- **fast-xml-parser** (XML parsing)
- Helvetica standard font (built into PDF)

## Data Flow
1. XML uploaded → parsed by `NfeXmlParser` → `DanfeData` DTO
2. DTO sent to `DanfeRendererService` (PDFKit-based)
3. PDFKit draws each element at absolute coordinates
4. PDF saved to `uploads/pdf-storage/`, record in `pdf_documents`
5. `invoice.pdfPath` updated

## Layout Reference
- **Page**: A4 vertical (595 × 842 pts)
- **Origin**: top-left corner
- **Margins**: ~14pt left, 14pt right, 10pt top, 14pt bottom
- **Font**: Helvetica (NOT Helvetica-Bold)
- Sizes: labels 4pt, values 7pt, section titles 5-6pt, company name 12pt
- **Line width**: ~0.25pt borders

## Sections (top→bottom)
1. Recebemos De (y=14–47)
2. DANFE Header + Barcode + Chave (y=49–145)
3. Natureza + Protocolo (y=145–169)
4. IE/IE Subst/CNPJ (y=169–194)
5. Destinatário (y=194–278)
6. Fatura/Duplicatas (y=278–311)
7. Cálculo do Imposto (y=311–369)
8. Transportador (y=369–453)
9. Produtos (y=453–686, per-row=12pt)
10. Versão + ICMS/IPI row (y=686–693)
11. ISSQN (y=693–727)
12. Dados Adicionais (y=727–820)
13. Footer (y=820+)

## Coordinates (detailed)
See the full prompt and `pdf-generator.service.ts` for all x/y/width/height values.

## Formatting Rules
- **Dates**: `2026-05-27T15:39:35-03:00` → `27/05/2026`, `15:39:35`
- **CNPJ**: `84987379000165` → `84.987.379/0001-65`
- **CPF**: `11876932945` → `118.769.329-45`
- **CEP**: `86705540` → `86705-540`
- **Phone**: `4332765200` → `(43) 3276-5200`, `4399682000` → `(43) 99682-0000`
- **Currency totals**: `1150.00` → `R$ 1.150,00`
- **Product values**: `1150.00` → `1.150,00` (no R$)
- **Unit value**: `1150` → `1.150,0000`
- **Quantity**: `1` → `1,0000`
- **CST (CSOSN)**: `orig=0, CSOSN=500` → `0500`
- **Frete mode**: `9` → `9-SEM FRETE`

## Barcode (Code128)
- Content: chave de acesso (44 digits, no spaces)
- Position: x=367, y=59, w=201, h=22
- Below: formatted chave text in groups of 4

## Validation
- Compare generated PDF vs reference (2615.pdf) at 200 DPI
- Accept: <1% pixel difference
- Check all fields, positions, alignment

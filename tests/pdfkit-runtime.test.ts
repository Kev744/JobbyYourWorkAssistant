describe('PDFKit runtime integration', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('node:fs');
    jest.dontMock('pdfkit');
  });

  it('disables PDFKit standard font loading before registering application fonts', async () => {
    const constructorOptions: Array<Record<string, unknown>> = [];
    const MockPdfDocument = createMockPdfDocument({ constructorOptions });

    jest.doMock('node:fs', () => ({
      existsSync: jest.fn(() => true),
    }));
    jest.doMock('pdfkit', () => ({
      __esModule: true,
      default: MockPdfDocument,
    }));

    const { generateDocumentFromText } = await import('@/lib/export/simple-documents');

    const document = generateDocumentFromText('CV', 'Expérience TypeScript', 'pdf');

    expect(document.contentType).toBe('application/pdf');
    expect(constructorOptions).toHaveLength(1);
    expect(constructorOptions[0]).toEqual(expect.objectContaining({ font: null }));
  });

  it('draws PDF text from the top of the page toward the bottom', async () => {
    const textCalls: Array<{ text: string; y: number }> = [];
    const MockPdfDocument = createMockPdfDocument({ textCalls });

    jest.doMock('node:fs', () => ({
      existsSync: jest.fn(() => true),
    }));
    jest.doMock('pdfkit', () => ({
      __esModule: true,
      default: MockPdfDocument,
    }));

    const { generateDocumentFromText } = await import('@/lib/export/simple-documents');

    generateDocumentFromText('', 'Première ligne\nDeuxième ligne\nTroisième ligne', 'pdf');

    expect(textCalls.map((call) => call.text)).toEqual([
      'Première ligne',
      'Deuxième ligne',
      'Troisième ligne',
    ]);
    expect(textCalls[0].y).toBeLessThan(textCalls[1].y);
    expect(textCalls[1].y).toBeLessThan(textCalls[2].y);
  });
});

function createMockPdfDocument({
  constructorOptions,
  textCalls,
}: {
  constructorOptions?: Array<Record<string, unknown>>;
  textCalls?: Array<{ text: string; y: number }>;
}) {
  const pdfBytes = Buffer.from('%PDF-1.3\nxref\ntrailer\nstartxref\n9\n%%EOF', 'latin1');

  return class MockPdfDocument {
    private hasRead = false;

    constructor(options: Record<string, unknown>) {
      constructorOptions?.push(options);

      if (options.font !== null) {
        throw new Error('PDFKit attempted to load its default Helvetica font.');
      }
    }

    registerFont() {
      return this;
    }

    font() {
      return this;
    }

    fontSize() {
      return this;
    }

    text(text: string, _x: number, y: number) {
      textCalls?.push({ text, y });
      return this;
    }

    save() {
      return this;
    }

    lineWidth() {
      return this;
    }

    moveTo() {
      return this;
    }

    lineTo() {
      return this;
    }

    stroke() {
      return this;
    }

    restore() {
      return this;
    }

    end() {
      return this;
    }

    read() {
      if (this.hasRead) {
        return null;
      }

      this.hasRead = true;
      return pdfBytes;
    }
  };
}

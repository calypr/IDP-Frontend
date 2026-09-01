type Coding = {
  display?: unknown;
  code?: unknown;
};

type StructuredCellValue = {
  text?: unknown;
  coding?: unknown;
};

/**
 * Converts arbitrary JSON-backed data into text that is safe to put in JSX.
 *
 * FHIR values commonly arrive as objects (for example, CodeableConcept), so
 * they must never be passed directly as React children. Prefer their human
 * readable text/coding labels and fall back to JSON for other objects.
 */
export const renderCell = (value: unknown): string => {
  if (value == null) return '';

  if (Array.isArray(value)) {
    return value.map(renderCell).filter(Boolean).join(', ');
  }

  if (typeof value !== 'object') {
    return String(value);
  }

  const object = value as StructuredCellValue;

  if (typeof object.text === 'string' && object.text) {
    return object.text;
  }

  if (Array.isArray(object.coding)) {
    const labels = object.coding
      .map((coding): string => {
        if (!coding || typeof coding !== 'object') return '';

        const { display, code } = coding as Coding;
        return renderCell(display || code);
      })
      .filter(Boolean);

    if (labels.length) return labels.join(', ');
  }

  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    // Keep the formatter safe for any value a caller may pass to it.
    return String(value);
  }
};

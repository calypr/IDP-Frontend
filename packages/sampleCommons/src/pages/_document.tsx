import Document, { DocumentContext, DocumentInitialProps } from 'next/document';
import { ColorSchemeScript } from '@mantine/core';
import React from 'react';

class Gen3Document extends Document {
  static async getInitialProps(
    ctx: DocumentContext,
  ): Promise<DocumentInitialProps> {
    const initialProps = await Document.getInitialProps(ctx);
    return {
      ...initialProps,
      styles: (
        <React.Fragment>
          {initialProps.styles}
          <ColorSchemeScript defaultColorScheme="auto" />
        </React.Fragment>
      ),
    };
  }
}

export default Gen3Document;

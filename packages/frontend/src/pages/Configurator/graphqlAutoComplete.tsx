import { useEffect, useState } from 'react';
import { getAutocompleteSuggestions } from 'graphql-language-service-interface';
import { IPosition } from 'graphql-language-service-types';
import { Autocomplete } from '@mantine/core';
import { type GraphQLSchema } from 'graphql';

export const GraphQLAutocomplete = ({
  value,
  onChange,
  placeholder,
  schema,
  context,
  tabType,
}: {
  value: string;
  onChange: ((value: string) => void) | undefined;
  placeholder: string | undefined;
  schema: GraphQLSchema;
  context: string | undefined;
  tabType: string | undefined;
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    let queryText: string;
    let cursorPosition: IPosition;
    if (context === 'tabType') {
      queryText = `query { ${value}`;
      cursorPosition = { line: 1, character: 8 + value.length } as IPosition;
    } else if (context === 'fieldName' && tabType) {
      queryText = `query { ${tabType} { ${value}`;
      cursorPosition = {
        line: 1,
        character: 11 + tabType.length + value.length,
      } as IPosition;
    } else {
      setSuggestions([]);
      return;
    }

    try {
      const rawSuggestions = getAutocompleteSuggestions(
        schema,
        queryText,
        cursorPosition,
      );
      const processedSuggestions = Array.isArray(rawSuggestions)
        ? rawSuggestions
            .map((s) => s.label)
            .filter((s) => s && !s.startsWith('__') && !s.startsWith('_'))
        : [];
      setSuggestions(processedSuggestions);
    } catch (error) {
      console.error('Error generating autocomplete suggestions:', error);
      setSuggestions([]);
    }
  }, [value, schema, context, tabType]);

  return (
    <Autocomplete
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      data={suggestions}
      color="secondary.0"
    />
  );
};

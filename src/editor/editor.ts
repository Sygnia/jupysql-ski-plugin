import { Compartment, EditorState, Extension } from "@codemirror/state"
import { python } from "@codemirror/lang-python"
import { sql, PostgreSQL, SQLDialect} from '@codemirror/lang-sql'
import { parser as pythonParser } from '@lezer/python'
import {parseMixed} from "@lezer/common"
import {LRLanguage} from "@codemirror/language"
const MAGIC = '%%sql';

let skiSnowflakeDialect = SQLDialect.define({
    charSetCasts: true,
    doubleDollarQuotedStrings: true,
    operatorChars: "+-*/<>=~!@#%^&|`?",
    specialVar: "",
    keywords: PostgreSQL.spec.keywords + ' v_name listagg ',
    types: PostgreSQL.spec.types
});
// @ts-ignore
console.log(skiSnowflakeDialect.dialect.words)

const config = {
  dialect: skiSnowflakeDialect
}

const sqlLang = sql(config);
function skiPython() {

  const mixedPythonLanguage = pythonParser.configure({
    wrap: parseMixed((node, input) => {
      const nodeIsAcceptedStringType =
        node.name === 'String' || node.name === 'FormatString';

      if (
        !nodeIsAcceptedStringType ||
        node.node.parent?.name !== 'ArgList' ||
        node.node.parent?.parent?.name !== 'CallExpression'
      ) {
        return null;
      }

      const functionExpression = node.node.parent.parent;
      const isJavascript =
        input.chunk(functionExpression.from).match(/^ski.search/i) !== null;

      if (!isJavascript) {
        return null;
      }

      const nodeText = input.read(node.from, node.to);

      if (nodeText.length < 2) {
        return null;
      }

      const openingQuoteStatement = nodeText.match(
        /^(?<openingQuote>[furbFURB]{0,2}(?:['"]{3}|['"]{1}))/,
      )?.groups?.openingQuote;

      const from = openingQuoteStatement
        ? node.from + openingQuoteStatement.length
        : node.from;

      const nodeTextWithoutOpeningQuote = openingQuoteStatement
        ? nodeText.replace(openingQuoteStatement, '')
        : nodeText;

      const closingQuoteStatement = nodeTextWithoutOpeningQuote.match(
        /(?<closingQuote>['"]{3}|['"]{1})$/,
      )?.groups?.closingQuote;

      const closingQuoteLength = closingQuoteStatement?.length ?? 0;

      const to = node.to - closingQuoteLength;

      const overlay = [
        {
          from,
          to,
        },
      ];

      if (overlay[0].from >= overlay[0].to) {
        return null;
      }

      return {
        parser: sqlLang.language.parser,
        overlay,
      };
    }),
  });

  //
  // return new LanguageSupport(mixedPythonLanguage, [
  //   sqlLang.language.data.of({autocomplete: customAutocomplete})
  // ]);
  return mixedPythonLanguage;
}



const mixedHTMLParser = pythonParser.configure({
  wrap: parseMixed(node => {
    console.log(node, node.name);
    console.log(node.tree)

    return node.name == "String" ? {parser: sql().language.parser} : null
  })
})

const mixedHTML = LRLanguage.define({parser: mixedHTMLParser})

const skiPythonLRLanguage = LRLanguage.define({parser: skiPython()})
// const MAGIC = '%%sql';
const languageConf = new Compartment;

/**
 * This function is called for every transaction (change in cell input).
 * If the cell is an SQL cell (starting with '%%sql'), then the language is set to SQL.
 */
const autoLanguage = EditorState.transactionExtender.of(tr => {
    // Check if the cell input content start with '%%sql', and configure the syntax
    // highlighting to SQL if necessary (default to python).
    const isSQL = tr.newDoc.sliceString(0, MAGIC.length) === MAGIC;
    return {
        effects: languageConf.reconfigure(isSQL ? sql() : python())
    };
})
console.log(autoLanguage, mixedHTML)



// Full extension composed of elemental extensions
export function languageSelection(): Extension {
    return [
        // languageConf.of(python()),
        skiPythonLRLanguage,
    ];
}

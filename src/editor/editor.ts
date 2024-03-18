import {Extension} from "@codemirror/state"
import {sql, SQLDialect,PostgreSQL} from '@codemirror/lang-sql'
import { pythonLanguage } from '@codemirror/lang-python'
// import {parser as pythonParser} from '@lezer/python'
import {parseMixed} from "@lezer/common"
import {LRLanguage} from "@codemirror/language"
import {keywords as snowflakeKeywordsSchema, functions as snowflakeFunctionsSchema} from '../snowflake_schema.json';
// import { keywords as skiKeywordsSchema } from '../ski_schema.json';
import {LRParser} from '@lezer/lr';
import {styleTags, tags} from "@lezer/highlight"

/**
 * This is based on CodeMirror overlays (https://codemirror.net/examples/mixed-language/)
 * And mostly taken from this examples from this thread:
 * https://discuss.codemirror.net/t/accessing-syntax-tree-of-nested-language-within-autocomplete/6499
 */

let snowflakeKeywords: string[] = snowflakeKeywordsSchema.map((k) => k.name);
let snowflakeFunctions: string[] = snowflakeFunctionsSchema.map((k) => k.name);
// let skiKeywords: string[] = skiKeywordsSchema.map((k) => k["name"]);

console.log("Activating editor!")

/**
 * Define a "ski dialect" to include snowflake keywords + ski keywords
 */
let skiSnowflakeDialect = SQLDialect.define({
    charSetCasts: true,
    doubleDollarQuotedStrings: true,
    operatorChars: "+-*/<>=~!@#%^&|`?",
    specialVar: "",
    keywords:  PostgreSQL.spec.keywords + snowflakeKeywords.join(" "),
    types: PostgreSQL.spec.types + snowflakeFunctions.join(" "),
    slashComments: true
});

const config = {
    dialect: skiSnowflakeDialect
}

const sqlLang = sql(config);

function skiPython() {

    const mixedPythonLanguage = pythonLanguage.parser.configure({
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
            const isSkiSearch =
                input.chunk(functionExpression.from).match(/^ski.search/i) !== null;

            if (!isSkiSearch) {
                return null;
            }

            const nodeText = input.read(node.from, node.to);

            if (nodeText.length < 2) {
                return null;
            }

            // We want to get the exact location of the string content inside the quotes

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

            let p: LRParser = sqlLang.language.parser as LRParser

            /**
             * Default highlighting ignores things that are not keywords (the green words)
             * So we can further customize it here
             */
            p = p.configure({
                props: [
                    styleTags({
                        // Type - things like array, count
                        Type: tags.atom,
                        // Identifier: tags.atom
                    })
                ]
            })

            return {
                parser: p,
                overlay,
            };
        }),
    });

    return mixedPythonLanguage;
}


const skiParser = skiPython();


const skiPythonLRLanguage = LRLanguage.define({
    parser: skiParser,
    // Keep settings from the python language (copied from their source)
    languageData: {
        closeBrackets: {
            brackets: ["(", "[", "{", "'", '"', "'''", '"""'],
            stringPrefixes: ["f", "fr", "rf", "r", "u", "b", "br", "rb",
                "F", "FR", "RF", "R", "U", "B", "BR", "RB"]
        },
        commentTokens: { line: "#" },
        indentOnInput: /^\s*([\}\]\)]|else:|elif |except |finally:)$/
    }
})


export function languageSelection(): Extension {
    return [
        skiPythonLRLanguage,
    ];
}

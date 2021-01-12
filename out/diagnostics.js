'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const imports = require("./imports")
const path = require("path");
const includeLineRegex = /^\s*\#?(include)[\W]+"([^"]+)".*$/i;
const labelDefinitionRegex = /^((([a-zA-Z_][a-zA-Z_0-9]*)?\.)?[a-zA-Z_][a-zA-Z_0-9]*[:]{0,2}).*$/;
const wordregex = /([\w\.]+(\.\w+)?(\.|\b))/g
const numberRegex = /((\$|0x)[0-9a-fA-F]+\b)|(\b[0-9a-fA-F]+h\b)|(%[01]+\b)|(\b[01]+b\b)|(\b[0-9]+d?\b)/g
const firstoperandregex = /^\s*[\w\.]+\s+([^\,\r\n\f\v]+)/
const secondoperandregex = /^.*?,\s*(.*)/
const nonCommentRegex = /^([^;]+[^\,\r\n\t\f\v ;])/g
const opcodeRegex = /\b(ADC|ADD|CP|DAA|DEC|INC|MLT|NEG|SBC|SUB|BIT|RES|SET|CPD|CPDR|CPI|CPIR|LDD|LDDR|LDI|LDIR|EX|EXX|IN|IN0|IND|INDR|INDRX|IND2|IND2R|INDM|INDMR|INI|INIR|INIRX|INI2|INI2R|INIM|INIMR|OTDM|OTDMR|OTDRX|OTIM|OTIMR|OTIRX|OUT|OUT0|OUTD|OTDR|OUTD2|OTD2R|OUTI|OTIR|OUTI2|OTI2R|TSTIO|LD|LEA|PEA|POP|PUSH|AND|CPL|OR|TST|XOR|CCF|DI|EI|HALT|IM|NOP|RSMIX|SCF|SLP|STMIX|CALL|DJNZ|JP|JR|RET|RETI|RETN|RST|RL|RLA|RLC|RLCA|RLD|RR|RRA|RRC|RRCA|RRD|SLA|SRA|SRL)\b/i;
const noOperandOpcodeRegex = /\b(DAA|NEG|CPD|CPDR|CPI|CPIR|LDD|LDDR|LDI|LDIR|EXX|IND|INDR|INDRX|IND2|IND2R|INDM|INDMR|INI|INIR|INIRX|INI2|INI2R|INIM|INIMR|OTDM|OTDMR|OTDRX|OTIM|OTIMR|OTIRX|OUTD|OTDR|OUTD2|OTD2R|OUTI|OTIR|OUTI2|OTI2R|CCF|DI|EI|HALT|NOP|RSMIX|SCF|SLP|STMIX|RETI|RETN|RLA|RLCA|RRA|RRCA|RRD)\b/i;
const suffixRegex = /(\.)(LIL|LIS|SIL|SIS|L|S)\b/i;
const todoRegex = /.*;\s*todo\b:?\s*(.*)/i
const bitopcodes = /\b(bit|res|set)\s+(\w+)\b/i
const replacementRegex = /((\+|\b)(A|B|C|D|E|F|H|L|I|R|IX|IY|IXH|IXL|IYH|IYL|AF|BC|DE|HL|PC|SP|AF'|MB|Z|NZ|C|NC|P|M|PO|PE)(\+|\b))/gi
const validNumber = "number"
const evalReg = new RegExp(validNumber + "|" + replacementRegex.source, "gi")
const valid = "valid"
const validRegex = new RegExp("\\b" + valid + "\\b", "g")
const bigNumber = "mmn"
const smallNumber = "n"
const offset = "d"


/**
 * This does a lot, scans table.possibleRefs, checks if opcodes/operands are correct, checks for duplicate declarations
 */
class diagnosticProvider {
       /**
        * @param {imports.symbolDocumenter} symbolDocumenter 
        * @param {imports.ASMCompletionProposer} completionProposer 
        */
       constructor(symbolDocumenter, completionProposer) {
              this.symbolDocumenter = symbolDocumenter
              this.instructionItemsFull = completionProposer.instructionItemsNonForm
       }
       /**
        * @param {vscode.TextDocument} document 
        * @param {imports.DocumentTable} table 
        */
       scanRefs(document, table) {
              if (!table) {
                     table = this.symbolDocumenter.documents[document.uri.fsPath]
              }
              const collection = table.collection
              const symbols = this.symbolDocumenter.getAllof(document.uri.fsPath, "symbol", {})
              const refs = this.symbolDocumenter.getAllinTable(table, "refs", [])
              let previousLine = -1

              for (let i = 0; i < refs.length; i++) {
                     const diag = new vscode.Diagnostic(refs[i].range, "Symbol not found")
                     const curDiags = table.lines[refs[i].line].diagnostics
                     if (refs[i].line != previousLine) {
                            curDiags.length = 0
                            previousLine = refs[i].line
                     }
                     if (!this.symbolDocumenter.checkSymbol(refs[i].name, document.uri, symbols)) {
                            curDiags.push(diag)
                     }
              }
              if (vscode.workspace.getConfiguration().get("ez80-asm.diagnosticProvider")) {
                     collection.set(document.uri, this.getDocDiags(table))
              }
       }
       getLinesWithRefs(table) {
              const lines = table.lines.filter((line, index) => {
                     line.lineNumber = index
                     return line.refs && line.refs.length > 0
              })
              return lines
       }
       /**
        * @param {vscode.TextDocument} document 
        * @param {vscode.TextDocumentChangeEvent} event 
        */
       getDiagnostics(document, event) {
              const table = this.symbolDocumenter.documents[document.uri.fsPath]
              if (document.fileName.match(/^.+\.inc$/)) {
                     return
              }
              if (event && event.contentChanges.length > 1) {
                     for (let i = 0; i < event.contentChanges.length; i++) {
                            while (i < event.contentChanges.length - 1 && (event.contentChanges[i].range.start.line == event.contentChanges[i].range.end.line
                                   && event.contentChanges[i + 1].range.start.line == event.contentChanges[i + 1].range.end.line
                                   && event.contentChanges[i].range.start.line == event.contentChanges[i + 1].range.start.line)) {
                                   i++
                            }
                            const pseudoEvent = {}
                            pseudoEvent.contentChanges = []
                            pseudoEvent.contentChanges.push(event.contentChanges[i])
                            this.getDiagnostics(document, pseudoEvent)
                     }
                     return
              }
              const symbols = this.symbolDocumenter.getAllof(document.uri.fsPath, "symbol", {})
              const collection = table.collection
              let startLine = 0
              let endLine = document.lineCount
              if (event) {
                     startLine = event.contentChanges[0].range.start.line
                     endLine = event.contentChanges[0].range.end.line + 1
                     const newLinematch = event.contentChanges[0].text.match(/\n/g)
                     if (newLinematch) {
                            endLine += newLinematch.length
                     } else if (table.lines.length == document.lineCount && event.contentChanges[0].text === "") { // that's iffy
                            endLine = startLine + 1
                     }
              }
              for (let lineNumber = startLine; lineNumber < endLine; lineNumber++) {
                     const line = document.lineAt(lineNumber)
                     let diags = this.getLineDiagnostics(line.text, lineNumber, symbols, document)
                     if (diags && diags.length > 0) {
                            for (let i = 0; i < diags.length; i++) {
                                   table.lines[lineNumber].diagnostics.push(diags[i])
                            }
                     } else {
                            table.lines[lineNumber].diagnostics = []
                     }
              }
              if (vscode.workspace.getConfiguration().get("ez80-asm.diagnosticProvider")) {
                     collection.set(document.uri, this.getDocDiags(table))
              }
       }
       /**
        * 
        * @param {} table 
        * @param {[]} output 
        */
       getDocDiags(table, output) {
              if (!output) {
                     output = []
              }
              const lines = table.lines.filter((line, index) => {
                     line.lineNumber = index
                     return line.diagnostics.length > 0
              })
              for (let i = 0; i < lines.length; i++) {
                     for (let j = 0; j < lines[i].diagnostics.length; j++) {
                            const diagnostic = lines[i].diagnostics[j]
                            diagnostic.line = lines[i].lineNumber
                            diagnostic.range = new vscode.Range(diagnostic.line, diagnostic.range.start.character, diagnostic.line, diagnostic.range.end.character)
                            output.push(diagnostic)
                     }
              }
              return output
       }
       /**
        * 
        * @param {String} text 
        * @param {Number} lineNumber 
        * @param {{}} symbols 
        * @param {vscode.TextDocument} document 
        */
       getLineDiagnostics(text, lineNumber, symbols, document) {
              let diagnosticsArray = []
              if (text === "") {
                     return;
              }
              const todoMatch = text.match(todoRegex)
              if (todoMatch) {
                     const range = new vscode.Range(lineNumber, 0, lineNumber, text.length)
                     diagnosticsArray.push(new vscode.Diagnostic(range, "TODO: " + todoMatch[1], vscode.DiagnosticSeverity.Information))
              }
              const includeLineMatch = includeLineRegex.exec(text);
              let nonCommentMatch = text.match(nonCommentRegex)
              const labelMatch = text.match(labelDefinitionRegex)
              if (nonCommentMatch) {
                     nonCommentMatch = nonCommentMatch[0].replace(/\".+\"/g, "")
                     if (!labelMatch) {
                            if (includeLineMatch) {
                                   const filename = includeLineMatch[2];
                                   const fsRelativeDir = path.dirname(document.uri.fsPath);
                                   if (this.symbolDocumenter._resolveFilename(filename, fsRelativeDir) === "") {
                                          const endChar = includeLineMatch[0].length;
                                          const range = new vscode.Range(lineNumber, 0, lineNumber, endChar)
                                          diagnosticsArray.push(new vscode.Diagnostic(range, "File not found"));
                                   }
                                   return diagnosticsArray;
                            }
                            const textLength = nonCommentMatch.length
                            let diagline = nonCommentMatch
                            diagline = diagline.replace(numberRegex, validNumber);
                            const diagwordmatch = diagline.match(wordregex);
                            let opcodeskip = false
                            let invalid = true
                            if (!diagline.match(/^\s*(\#|\.|db|dw|dl)/gi)) {      // check the opcode
                                   const startChar = text.indexOf(diagwordmatch[0])
                                   const endChar = startChar + diagwordmatch[0].length
                                   if (diagwordmatch[0].indexOf(".") != -1 && !diagwordmatch[0].match(suffixRegex)) {       // if the suffix isn't valid
                                          const range = new vscode.Range(lineNumber, startChar, lineNumber, endChar)
                                          diagnosticsArray.push(new vscode.Diagnostic(range, "Bad suffix"));
                                   } else if (diagwordmatch[0].indexOf(".") != -1) {
                                          diagline = diagline.replace(/\.\w+/, "")  // remove the suffix from the test line if it's valid
                                   }
                                   if (!diagwordmatch[0].match(opcodeRegex)) {        // if the opcode isn't valid
                                          const range = new vscode.Range(lineNumber, startChar, lineNumber, endChar)
                                          diagnosticsArray.push(new vscode.Diagnostic(range, "Unknown ez80 opcode"));
                                          return diagnosticsArray;
                                   } else if (diagwordmatch[0].match(noOperandOpcodeRegex)) { // if the opcode doesn't use an operand
                                          if (diagwordmatch.length > 1) {
                                                 const range = new vscode.Range(lineNumber, startChar, lineNumber, endChar)
                                                 diagnosticsArray.push(new vscode.Diagnostic(range, "No operand needed for this opcode"));
                                                 return diagnosticsArray;
                                          } else {
                                                 opcodeskip = true    // ret
                                          }
                                   }
                            } else {
                                   opcodeskip = true
                            }
                            if (!opcodeskip) {
                                   for (let i = 1; i < diagwordmatch.length; i++) {    // replace all the symbols with "number"
                                          if (this.symbolDocumenter.checkSymbol(diagwordmatch[i], document.uri, symbols)) {
                                                 diagline = diagline.replace(diagwordmatch[i], validNumber)
                                          }
                                   }
                                   diagline = this.formatLine(diagline);
                                   let operands = this.getOperands(diagline);
                                   diagline = diagline.replace(/(.+)/g, function (match) {
                                          const opcode = match.match(/^\s+(\w+)/)
                                          for (let i = 0; i < operands.length; i++) {
                                                 operands[i] = operands[i].replace(/ /g, "")
                                          }
                                          if (operands.length == 1) {
                                                 return opcode[1] + " " + operands[0]
                                          } else if (operands.length == 2) {
                                                 return opcode[1] + " " + operands[0] + ", " + operands[1]
                                          } else if (operands.length == 0) {
                                                 return opcode[1]
                                          } else {
                                                 return match
                                          }
                                   })
                                   diagline = this.evalOperands(diagline, operands)
                                   diagline = diagline.replace(bitopcodes, (match) => {
                                          return match.replace(valid, "bit")
                                   })
                                   invalid = this.testLine(diagline)
                                   if (invalid) {
                                          const endChar = textLength;
                                          const range = new vscode.Range(lineNumber, 0, lineNumber, endChar)
                                          diagnosticsArray.push(new vscode.Diagnostic(range, "Bad operands"));
                                   }
                            }
                     }
              }
              return diagnosticsArray
       }
       formatLine(line) {
              line = line.toLowerCase();
              line = line.replace(/\'.+\'/, validNumber)
              line = line.replace(/(\+|-|\/|\*)/gi, "+")
              return line
       }
       getOperands(line) {
              let operands = []
              let operand = line.match(firstoperandregex)
              if (operand) {
                     operands.push(operand[1])
              }
              operand = line.match(secondoperandregex)
              if (operand) {
                     operands.push(operand[1])
              }
              return operands
       }
       testLine(line) {
              if (this.instructionItemsFull.indexOf(line) != -1) {
                     return false
              }
              let test = line.replace(validRegex, bigNumber)
              if (this.instructionItemsFull.indexOf(test) != -1) {
                     return false
              }
              test = line.replace(validRegex, smallNumber)
              if (this.instructionItemsFull.indexOf(test) != -1) {
                     return false
              }
              test = line.replace(validRegex, offset)
              if (this.instructionItemsFull.indexOf(test) != -1) {
                     return false
              }
              return true
       }
       evalOperands(line, operands) {
              for (let i = 0; i < operands.length; i++) {
                     try {
                            eval(operands[i].replace(evalReg, 1))
                            let withoutParen = operands[i].match(/(?<=^\()(.*)(?=\)$)/)
                            if (!withoutParen) {
                                   withoutParen = [operands[i]]
                            }
                            withoutParen[0] = withoutParen[0].replace(replacementRegex, "")
                            if (withoutParen[0] === "") {
                                   continue
                            }
                            line = line.replace(withoutParen[0], valid)
                     } catch (err) {
                     }
              }
              return line
       }
}
exports.diagnosticProvider = diagnosticProvider

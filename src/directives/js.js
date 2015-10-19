/**
 * @fileoverview JavaScript directive handler.
 */

import _       from "lodash";
import path    from 'path';
import assets  from '../assets';
import dir     from '../common/directory';
import File    from '../common/file';
import builder from '../builders/js';
import Parser  from '../parsers/js';
import { Transformer } from '../transformer';

export class Js extends Transformer {
  /**
   * @param {Vinyl} The vinyl file.
   * @param {Object} options .
   * @return {Vinyl} Transformed vinyl.
   */
  transform(vFile, options) {
    const parsed = Parser.parse(vFile.contents.toString());
    const code = this.generateCode(
        parsed, this.getRequires(parsed), options);
    vFile.contents = new Buffer(code);
    return vFile;
  }

  /**
   * @param {Root} parsed PostCSS AST.
   * @return {Array.<String>} Required paths.
   */
  getRequires(parsed) {
    const comments = parsed.comments;
    if (1 > comments.length) {
      return [];
    }

    let requires = [];
    let stubs = [];

    comments.forEach((comment) => {
      this.getDirectives(comment.value).forEach((directive) => {
        switch (directive.directive) {
          case 'require':
            requires.push(this.requireDirective(directive.path));
            break;
          case 'require_tree':
            requires.push.apply(
                requires, this.requireTreeDirective(directive.path));
            break;
          case 'stub':
            stubs.push(this.stubDirective(directive.path));
            break;
        }
      });
    });

    return requires.filter(function(req) {
      return 0 > stubs.indexOf(req);
    });
  }

  /**
   * @param {Js} parsed ..
   * @param {Array.<String>} Required paths.
   * @param {Object} options .
   * @return {String} Replaced JavaScript String.
   */
  generateCode(parsed, requires, options) {
    const buf = requires.map(function(req) {
      const res = builder.transform(File.createVinyl(req), options);
      return res.contents.toString();
    });
    return buf.join('\n') + '\n' + parsed.code();
  }

  /**
   * @param {String} p File path.
   * @return {String} Asset path.
   */
  requireDirective(p) {
    return assets.findJavaScript(p);
  }

  /**
   * @param {String} p Directory path.
   * @return {Array.<String>} Asset paths.
   */
  requireTreeDirective(p) {
    return _.flatten(assets.javascriptPaths.map((javascriptPath) => {
      const dirPath = path.join(javascriptPath, p);
      return dir.list(dirPath, true).map((p2) => {
        return assets.findJavaScript(p2, true);
      });
    }));
  }

  /**
   * @param {String} p File path.
   * @return {String} Asset path.
   */
  stubDirective(p) {
    return assets.findJavaScript(p);
  }

  /**
   * @param {String} comment .
   * @return {Object} Analyzed directive.
   */
  getDirectives(comment) {
    return comment.split('\n').map(function(line) {
      let text = line.replace(/^.*=/, '').trim();
      if (text.match(/^(require|require_tree|stub)\s(.+)/)) {
        return { directive: RegExp.$1, path: RegExp.$2 };
      } else {
        return { directive: null, path: null };
      }
    });
  }
}

// singleton
export default new Js();

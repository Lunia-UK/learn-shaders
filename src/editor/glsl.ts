// GLSL ES 3.00 syntax highlighting for CodeMirror, built on the C-like legacy mode.
import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import { clike } from '@codemirror/legacy-modes/mode/clike';
import { tags } from '@lezer/highlight';

/** The C-like mode expects word lists as { word: true } objects. */
function words(list: string): Record<string, boolean> {
  return Object.fromEntries(list.split(/\s+/).map((word) => [word, true]));
}

// Word lists from the GLSL ES 3.00 specification, sections 3.7 (keywords) and 8 (built-in functions).
const glslParser = clike({
  name: 'glsl',
  keywords: words(`
    const uniform in out inout centroid flat smooth layout invariant precision highp mediump lowp
    break continue do for while switch case default if else discard return struct`),
  types: words(`
    void bool int uint float vec2 vec3 vec4 bvec2 bvec3 bvec4 ivec2 ivec3 ivec4 uvec2 uvec3 uvec4
    mat2 mat3 mat4 mat2x2 mat2x3 mat2x4 mat3x2 mat3x3 mat3x4 mat4x2 mat4x3 mat4x4
    sampler2D sampler3D samplerCube sampler2DShadow samplerCubeShadow sampler2DArray
    sampler2DArrayShadow isampler2D isampler3D isamplerCube isampler2DArray
    usampler2D usampler3D usamplerCube usampler2DArray`),
  blockKeywords: words('for while do if else switch struct'),
  builtin: words(`
    radians degrees sin cos tan asin acos atan sinh cosh tanh asinh acosh atanh
    pow exp log exp2 log2 sqrt inversesqrt abs sign floor trunc round roundEven ceil fract mod modf
    min max clamp mix step smoothstep isnan isinf floatBitsToInt floatBitsToUint intBitsToFloat
    uintBitsToFloat packSnorm2x16 unpackSnorm2x16 packUnorm2x16 unpackUnorm2x16 packHalf2x16
    unpackHalf2x16 length distance dot cross normalize faceforward reflect refract
    matrixCompMult outerProduct transpose determinant inverse
    lessThan lessThanEqual greaterThan greaterThanEqual equal notEqual any all not
    textureSize texture textureProj textureLod textureOffset texelFetch texelFetchOffset
    textureProjOffset textureLodOffset textureProjLod textureProjLodOffset textureGrad
    textureGradOffset textureProjGrad textureProjGradOffset dFdx dFdy fwidth
    gl_FragCoord gl_FrontFacing gl_PointCoord`),
  // The values a lesson receives from the outside get their own color, as in the prototypes.
  atoms: words('uv time true false'),
});

export const glslLanguage = StreamLanguage.define(glslParser);

const glslHighlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.typeName], color: 'var(--code-keyword)', fontWeight: '600' },
  { tag: tags.standard(tags.variableName), color: 'var(--code-function)' },
  { tag: tags.atom, color: 'var(--code-input)', fontWeight: '600' },
  // Numbers keep the text color: pink is reserved for the numbers a learner can scrub.
  { tag: [tags.comment, tags.meta], color: 'var(--code-comment)', fontStyle: 'italic' },
]);

export const glsl = [glslLanguage, syntaxHighlighting(glslHighlightStyle)];

module.exports = {
  presets: [
    "@babel/preset-env",
    ["@babel/preset-typescript"],
    [
      "@babel/preset-react",
      {
        runtime: "automatic",
      },
    ],
  ],
  plugins: [
    [
      "babel-plugin-transform-import-ignore",
      {
        patterns: [".css"],
      },
    ],
  ],
}

const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`DevOps demo app listening on port ${PORT}`);
});

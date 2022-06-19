import express from 'express';

const app = express()


app.get('/list', (req, res) => {
  console.log(req.query);
  res.send('ok23')
})

app.listen(6789)
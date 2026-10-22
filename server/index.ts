import { env } from './config/env'
import { createApp } from './api/app'

const app = createApp()
app.listen(env.PORT, () => {
  console.log(`Gilar API listening on http://localhost:${env.PORT}`)
})

import { configureStore } from '@reduxjs/toolkit'
import detectImg2d from './floorplan2d/detectImg2d'

const store = configureStore({
  reducer: {
    detectImg2d: detectImg2d,
    // thêm reducer khác nếu cần
  },
})

export default store
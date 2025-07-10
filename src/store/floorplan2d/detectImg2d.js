import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  countClickUpdateFloorplan2d: 0,
}

export const storeSlice = createSlice({
  name: 'detectImg2d',
  initialState,
  reducers: {
    // increment: state => {
    //   state.value += 1
    // },
    // decrement: state => {
    //   state.value -= 1
    // },
    UPDATE_CLICK_UPDATE_FLOORPLAN_2d: (state, action) => {
      console.log("vao day roi neUPDATE_CLICK_UPDATE_FLOORPLAN_2d")
      state.countClickUpdateFloorplan2d += 1
    },
  },
})

// export const { increment, decrement, incrementByAmount } = counterSlice.actions

export const storeSliceActions = storeSlice.actions;
export default storeSlice.reducer;



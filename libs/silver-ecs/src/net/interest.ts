import {ref, rel} from "#component"
import * as InterestQueue from "./interest_queue.ts"

export let Interest = ref(InterestQueue.make)
export let HasInterest = rel({exclusive: true})

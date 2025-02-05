import {ref, rel} from "#component"
import * as Entity from "#entity"
import * as InterestQueue from "./interest_queue"

export let Topic = ref(InterestQueue.make)
export let Interest = rel({exclusive: true})

package com.example.pay.util

import org.junit.Assert.assertEquals
import org.junit.Test

class FormattersTest {
    @Test
    fun `displayToIsoDate converts slash format`() {
        assertEquals("2026-03-03", displayToIsoDate("03/03/2026"))
    }

    @Test
    fun `isoToDisplayDate converts iso format`() {
        assertEquals("03/03/2026", isoToDisplayDate("2026-03-03"))
    }
}

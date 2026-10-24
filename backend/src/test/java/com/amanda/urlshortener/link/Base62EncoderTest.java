package com.amanda.urlshortener.link;

import java.math.BigInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import static org.junit.jupiter.api.Assertions.*;

class Base62EncoderTest {
    private final Base62Encoder encoder = new Base62Encoder();

    @ParameterizedTest
    @CsvSource({"0,0", "1,1", "9,9", "10,A", "35,Z", "36,a", "61,z", "62,10",
        "3843,zz", "3844,100", "1000000,4C92", "3521614606208,10000000"})
    void encodesKnownValuesAndLengthBoundaries(long id, String expected) {
        assertEquals(expected, encoder.encode(id));
    }

    @Test
    void handlesTheEntirePositiveLongRangeWithoutTruncation() {
        String encoded = encoder.encode(Long.MAX_VALUE);
        assertEquals(Base62Encoder.MAX_CODE_LENGTH, encoded.length());
        String alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        BigInteger decoded = BigInteger.ZERO;
        for (char digit : encoded.toCharArray()) {
            decoded = decoded.multiply(BigInteger.valueOf(62)).add(BigInteger.valueOf(alphabet.indexOf(digit)));
        }
        assertEquals(BigInteger.valueOf(Long.MAX_VALUE), decoded);
    }

    @Test
    void rejectsNegativeIds() {
        assertThrows(IllegalArgumentException.class, () -> encoder.encode(-1));
    }
}

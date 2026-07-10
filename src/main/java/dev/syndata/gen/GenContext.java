package dev.syndata.gen;

import dev.syndata.ai.AiValuePool;
import net.datafaker.Faker;

import java.util.Locale;
import java.util.Random;

/** Shared state for one generation run: seeded randomness, faker, optional AI pool. */
public class GenContext {

    public final Random random;
    public final Faker faker;
    public final AiValuePool aiPool;

    public GenContext(long seed, Locale locale, AiValuePool aiPool) {
        this.random = new Random(seed);
        this.faker = new Faker(locale == null ? Locale.ENGLISH : locale, this.random);
        this.aiPool = aiPool;
    }
}

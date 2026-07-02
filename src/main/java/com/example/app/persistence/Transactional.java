package com.example.app.persistence;

import java.lang.annotation.ElementType;
import java.lang.annotation.Inherited;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import jakarta.enterprise.util.Nonbinding;
import jakarta.interceptor.InterceptorBinding;

/**
 * Lightweight local-transaction interceptor binding.
 *
 * Tomcat ships no JTA transaction manager, so jakarta.transaction.Transactional
 * has no backing implementation here. This binding + {@link TransactionInterceptor}
 * provide the same "wrap the method in a transaction" ergonomics using
 * EntityTransaction (RESOURCE_LOCAL). If you later need real JTA (XA,
 * multiple resources), embed Narayana or Atomikos - see README.
 */
@Inherited
@InterceptorBinding
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.METHOD, ElementType.TYPE})
public @interface Transactional {

    @Nonbinding
    boolean readOnly() default false;
}

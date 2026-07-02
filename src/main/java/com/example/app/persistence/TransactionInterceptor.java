package com.example.app.persistence;

import jakarta.annotation.Priority;
import jakarta.inject.Inject;
import jakarta.interceptor.AroundInvoke;
import jakarta.interceptor.Interceptor;
import jakarta.interceptor.InvocationContext;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityTransaction;

/**
 * Wraps intercepted methods in a RESOURCE_LOCAL EntityTransaction.
 * Supports nesting: only the outermost {@code @Transactional} method
 * begins/commits the transaction.
 */
@Interceptor
@Transactional
@Priority(Interceptor.Priority.APPLICATION)
public class TransactionInterceptor {

    @Inject
    private EntityManager em;

    @AroundInvoke
    public Object manageTransaction(InvocationContext ctx) throws Exception {
        EntityTransaction tx = em.getTransaction();
        if (tx.isActive()) {
            // Joining an already active transaction started by an outer call.
            return ctx.proceed();
        }
        tx.begin();
        try {
            Object result = ctx.proceed();
            tx.commit();
            return result;
        } catch (Exception e) {
            if (tx.isActive()) {
                tx.rollback();
            }
            throw e;
        }
    }
}

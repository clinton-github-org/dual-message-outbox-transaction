package com.clinton.authorization_server.aop;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.text.MessageFormat;

/**
 * @author Clinton Fernandes
 */
@Aspect
@Component
public class LoggingAspect {

    private static final Logger LOG = LoggerFactory.getLogger(LoggingAspect.class);

    @Pointcut("execution(* com.clinton.authorization_server.controller..*(..))")
    public void logPoints() {
    }

    @Around("logPoints()")
    public Object printLogs(ProceedingJoinPoint joinPoint) {
        Object object;
        String logString = MessageFormat.format("Starting Execution of Class: {0}, Method: {1}", joinPoint.getTarget().getClass().getName(), joinPoint.getSignature().getName());
        LOG.info(logString);
        try {
            object = joinPoint.proceed();
        } catch (Throwable e) {
            throw new RuntimeException(e);
        }
        logString = logString.replace("Starting", "Ending");
        LOG.info(logString);
        return object;
    }
}
